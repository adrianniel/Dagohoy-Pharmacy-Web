import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../components/toast';
import { isSoundEnabled, playSound, setSoundEnabled } from '../../lib/sound';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { getInventory } from '../../data/inventoryStore';
import {
  NoBarcodeItem,
  ScannedNewProduct,
  SetPriceItem,
} from '../../components/cashier/ScannedNewProduct';
import { CATALOG_SYNCED, syncAfterSale } from '../../data/serverSync';
import { createSale, voidSale, type ApiSale, type NewSale } from '../../services/storeApi';
import { SCANNER_OFF_MESSAGE, useScannerOff } from '../../services/useBilling';
import { getSession, STORE_STATUS_CHANGE_EVENT } from '../../data/registerSession';

type CatalogProduct = ReturnType<typeof getInventory>[number];
type PosProduct = Omit<CatalogProduct, 'stock' | 'status'> & {
  stock?: number;
  localProductId?: number;
  localProductUnitId?: number | null;
};
type CartLine = { product: PosProduct; quantity: number };

/**
 * The sale on the counter is kept in this browser while it is open, so going to another page
 * (or a refresh) and coming back continues it. Cleared when the sale is completed or cleared,
 * and on logout.
 */
const OPEN_SALE_KEY = 'dagohoy_open_sale';

function loadOpenSale(): { cart: CartLine[]; discount: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_SALE_KEY) ?? 'null') as {
      cart?: CartLine[];
      discount?: string;
    } | null;
    if (!saved?.cart?.length) return { cart: [], discount: '0' };
    // Refresh each item from the current product list (price, stock); drop removed ones.
    const inventory = getInventory();
    const cart = saved.cart.flatMap((line) => {
      const fresh = inventory.find((item) => item.barcode === line.product.barcode);
      if (!fresh || !(line.quantity > 0)) return [];
      const product: PosProduct = fresh.unregistered ? { ...fresh, stock: undefined } : fresh;
      return [{ product, quantity: line.quantity }];
    });
    return { cart, discount: saved.discount ?? '0' };
  } catch {
    return { cart: [], discount: '0' };
  }
}
type CompletedSale = {
  receipt: string;
  date: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  payment: SalePaymentLabel;
  amountPaid: number;
  change: number;
  customer?: string;
  reference?: string;
  cashier: string;
  paymentStatus?: string;
  creditBalance?: number;
  noChargeReason?: string;
};
type PaymentMethod = 'Cash' | 'GCash' | 'Credit';
type SalePaymentLabel = PaymentMethod | 'No charge';
type StoredSale = {
  id?: number;
  receipt: string;
  date: string;
  items?: number;
  total?: number;
  subtotal?: number;
  discount?: number;
  payment?: string;
  status?: string;
  creditBalance?: number;
  cashier?: string;
  customer?: string;
  noChargeReason?: string;
  lines?: Array<{ product: string; barcode: string; quantity: number; unitPrice: number }>;
};

const VOID_REASONS = ['Wrong item', 'Wrong quantity', 'Wrong price', 'Customer cancelled'];
const VOID_LIST_LIMIT = 10;

/** What the cashier has to do with the money when a sale is voided. */
function voidMoneyNote(sale: StoredSale) {
  const total = Number(sale.total ?? 0);
  switch (sale.payment) {
    case 'Cash':
      return `Give ${formatMoney(total)} back to the customer from the cash drawer.`;
    case 'GCash':
      return `Send ${formatMoney(total)} back to the customer through GCash.`;
    case 'Credit':
      return Number(sale.creditBalance ?? 0) > 0
        ? `The customer's unpaid balance of ${formatMoney(Number(sale.creditBalance))} is cleared. Return any part they already paid.`
        : `Return what the customer already paid on this credit sale.`;
    case 'No charge':
      return 'No money changed hands. The items only go back on the shelf.';
    default:
      return `Return ${formatMoney(total)} to the customer.`;
  }
}
const toAmount = (price: string) => Number(price.replace(/[₱,]/g, ''));
const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatReceiptDate = (value: string) =>
  new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
/**
 * Quick cash buttons: the exact amount first, then the next bills a customer is likely to
 * hand over (rounded up to ₱20, ₱50, ₱100, ₱500 and ₱1,000), without repeats.
 */
function quickCashAmounts(total: number): number[] {
  const exact = Math.round(total * 100) / 100;
  const rounded = [20, 50, 100, 500, 1000]
    .map((step) => Math.ceil(exact / step) * step)
    .filter((amount) => amount > exact);
  return [exact, ...Array.from(new Set(rounded))].slice(0, 5);
}
/*
 * Scanner detection: a scanner sends each key within a few milliseconds and the whole code in
 * well under a tenth of a second; a person types much slower. Shortcut: tuned for USB
 * keyboard-style scanners; if a slow Bluetooth scanner is missed, raise SCAN_KEY_GAP_MS.
 */
const SCAN_KEY_GAP_MS = 40;
const SCAN_IDLE_MS = 60;
const SCAN_MIN_LENGTH = 6;

const SALES_KEY = 'dagohoy_demo_sales';

function readSales(): StoredSale[] {
  return JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as StoredSale[];
}

const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';

/** "09171234567" → "0917 123 4567", "+639171234567" → "+63 917 123 4567". */
function formatGcashNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 12 && digits.startsWith('639')) {
    return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return value.trim();
}

const PAYMENT_METHOD_OPTIONS: Array<{
  id: PaymentMethod;
  name: string;
  detail: string;
  icon: 'cash' | 'phone' | 'credit';
}> = [
  { id: 'Cash', name: 'Cash', detail: 'Tendered cash', icon: 'cash' },
  { id: 'GCash', name: 'GCash', detail: 'Manual verification', icon: 'phone' },
  { id: 'Credit', name: 'Credit', detail: 'Utang / pay later', icon: 'credit' },
];

function sanitizeMoneyInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  const wholePart = whole.slice(0, 7);
  if (!rest.length) return wholePart;
  return `${wholePart}.${rest.join('').slice(0, 2)}`;
}

function sanitizeDiscountInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  const integerPart = (dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex)).slice(0, 6);
  const decimalPart =
    dotIndex === -1
      ? ''
      : cleaned
          .slice(dotIndex + 1)
          .replace(/\./g, '')
          .slice(0, 2);
  const next = dotIndex === -1 ? integerPart : `${integerPart}.${decimalPart}`;

  if (next === '' || next === '.') {
    return dotIndex === -1 ? '' : '0.';
  }
  return next;
}

export function CashierPosPage() {
  const [products, setProducts] = useState(getInventory);
  // Products and prices changed on another device show here once this window syncs again.
  useEffect(() => {
    const refresh = () => setProducts(getInventory());
    window.addEventListener(CATALOG_SYNCED, refresh);
    return () => window.removeEventListener(CATALOG_SYNCED, refresh);
  }, []);
  /** True while a sale, void or no-charge record is being saved on the server. */
  const [saving, setSaving] = useState(false);
  const [openSale] = useState(loadOpenSale);
  const [cart, setCart] = useState<CartLine[]>(openSale.cart);
  /** Barcode of the item added last (highlighted in the list) and a counter that replays the flash. */
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [addPulse, setAddPulse] = useState(0);
  /** Price check: while on, a scan only shows the product and its price; nothing is added. */
  const [priceCheck, setPriceCheck] = useState(false);
  const [checked, setChecked] = useState<CatalogProduct | null>(null);
  const [query, setQuery] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState(openSale.discount);
  // Keep the open sale so it is still here after visiting another page.
  useEffect(() => {
    try {
      if (cart.length) {
        localStorage.setItem(OPEN_SALE_KEY, JSON.stringify({ cart, discount: discountInput }));
      } else {
        localStorage.removeItem(OPEN_SALE_KEY);
      }
    } catch {
      // Storage full or blocked: the sale still works, it is just not kept.
    }
  }, [cart, discountInput]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [tendered, setTendered] = useState('');
  const [creditCustomer, setCreditCustomer] = useState('');
  const [gcashReference, setGcashReference] = useState('');
  const [gcashPaid, setGcashPaid] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [gcashDetails] = useState(() => {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as {
        gcashNumber?: string;
        gcashQrUrl?: string;
      };
      return { number: settings.gcashNumber ?? '', qrUrl: settings.gcashQrUrl ?? '' };
    } catch {
      return { number: '', qrUrl: '' };
    }
  });
  const [expandedProduct, setExpandedProduct] = useState<CatalogProduct | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  /** A scanned barcode that is not on the product list: the new-product popup is open. */
  const [newScan, setNewScan] = useState('');
  /** The "No barcode" popup is open. */
  const [noBarcodeOpen, setNoBarcodeOpen] = useState(false);
  /** A product on the list without a selling price yet: the price is asked before it is sold. */
  const [pricing, setPricing] = useState<PosProduct | null>(null);
  const [controlModal, setControlModal] = useState<'void' | 'charge' | null>(null);
  const [voidTarget, setVoidTarget] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [recentSales, setRecentSales] = useState<StoredSale[]>([]);
  const [noChargeReason, setNoChargeReason] = useState('');
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const { showToast } = useToast();
  // Payment needs an open shift (the server refuses a sale without one too).
  const [shiftOpen, setShiftOpen] = useState(() => Boolean(getSession()));
  useEffect(() => {
    const sync = () => setShiftOpen(Boolean(getSession()));
    window.addEventListener(STORE_STATUS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STORE_STATUS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  // The Sales Counter is always ready for the scanner: a sale is open as soon as it has an item.
  const transactionActive = cart.length > 0;
  const subtotal = cart.reduce(
    (total, line) => total + toAmount(line.product.price) * line.quantity,
    0,
  );
  const totalItems = cart.reduce((total, line) => total + line.quantity, 0);
  // The cashier works out the amount off on a calculator and types it in pesos.
  const discountTyped = Math.max(0, Math.round((Number(discountInput) || 0) * 100) / 100);
  const discount = Math.min(discountTyped, subtotal);
  const discountTooBig = discountTyped > subtotal && subtotal > 0;
  const totalDue = subtotal - discount;
  // The subscription is 7+ days late: the barcode scanner is off until it is paid. Selling goes
  // on by product name. It comes back by itself once a payment is sent.
  const scannerOff = useScannerOff();

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.product} ${product.detail} ${scannerOff ? '' : product.barcode}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [products, query, scannerOff],
  );
  const change = Math.max(0, Number(tendered) - totalDue);
  const creditBalance = Math.max(0, totalDue - Number(tendered || 0));

  /** Why the sale cannot be saved yet, in plain words; empty when it can. */
  const paymentBlocker =
    paymentMethod === 'Cash'
      ? !tendered
        ? 'Enter the cash the customer gave, or tap an amount.'
        : Number(tendered) < totalDue
          ? `The cash is ${formatMoney(totalDue - Number(tendered))} short of the total.`
          : ''
      : paymentMethod === 'GCash'
        ? gcashReference.trim().length < 3
          ? 'Enter at least the last 3 digits of the GCash reference number.'
          : ''
        : !creditCustomer.trim()
          ? 'Enter the customer name for the utang.'
          : Number(tendered) > totalDue
            ? 'Cash paid now cannot be more than the total.'
            : '';

  function closePayment() {
    setPaymentOpen(false);
    setCompletedSale(null);
  }

  function selectPaymentMethod(nextMethod: PaymentMethod) {
    setPaymentMethod(nextMethod);
    setTendered('');
    setGcashReference('');
    setGcashPaid(false);
  }

  /** Enter in the search: add the scanned product, or the only match of a typed name. */
  function scanOrPick(code: string) {
    if (!code) return;
    const exact = scannerOff ? undefined : products.find((product) => product.barcode === code);
    const pick = exact ?? (filteredProducts.length === 1 ? filteredProducts[0] : undefined);
    if (!pick) {
      if (!filteredProducts.length && !priceCheck && !scannerOff && /^\d{8,14}$/.test(code)) {
        setQuery('');
        setNewScan(code);
        return;
      }
      showToast(
        filteredProducts.length
          ? 'Several products match. Pick one from the list.'
          : `No product has barcode ${code}.`,
        'info',
      );
      return;
    }
    if (priceCheck) {
      setChecked(pick);
      setQuery('');
      return;
    }
    if (!pick.unregistered && pick.stock < 1) {
      showToast(`${pick.product} is out of stock.`, 'error');
      setQuery('');
      return;
    }
    addProduct(pick);
  }

  useEffect(() => {
    if (cart.length) return;
    setLastAdded(null);
  }, [cart.length]);

  // Keep the item just added in view, also in a long list.
  useEffect(() => {
    if (!addPulse) return;
    document.querySelector('.pos-ticket-line.is-latest')?.scrollIntoView({ block: 'nearest' });
  }, [addPulse]);

  /** A finished scan: the product goes straight into the sale. Kept current for the listener. */
  const onScan = useRef<(code: string) => void>(() => {});
  onScan.current = (code) => {
    // A scan on the "done" screen closes it and starts the next customer's sale.
    if (completedSale) closePayment();
    if (scannerOff) {
      showToast(SCANNER_OFF_MESSAGE, 'error');
      return;
    }
    const product = products.find((item) => item.barcode === code);
    if (!product) {
      if (priceCheck) {
        showToast(`No product has barcode ${code}. Turn off Price check to add it.`, 'info');
        return;
      }
      // Not on the product list: look it up and let the cashier set a price.
      setNewScan(code);
      return;
    }
    if (priceCheck) {
      setChecked(product);
      playSound('tap');
      return;
    }
    if (!product.unregistered && product.stock < 1) {
      showToast(`${product.product} is out of stock.`, 'error');
      return;
    }
    addProduct(product);
  };
  /**
   * Enter moves the sale along: at the counter it opens the payment, in the payment it saves the
   * sale (when nothing is missing), and on the "done" screen it closes it for the next customer.
   * Kept current for the key listener below.
   */
  const onEnterKey = useRef<(event: KeyboardEvent) => void>(() => {});
  onEnterKey.current = (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || controlModal) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (paymentOpen && completedSale) {
      event.preventDefault();
      closePayment();
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>('input[name="product-search"]')?.focus(),
      );
      return;
    }
    if (paymentOpen) {
      event.preventDefault();
      if (!paymentBlocker && !saving) {
        document.querySelector<HTMLFormElement>('form.pos-payment-modal--collect')?.requestSubmit();
      }
      return;
    }
    // At the counter a focused button (a sale control, + or −) keeps its own Enter.
    if (target?.tagName === 'BUTTON') return;
    if (cart.length && shiftOpen) {
      event.preventDefault();
      setPaymentOpen(true);
    }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onEnterKey.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  /** While the payment panel or a dialog is open, its own fields take the keys. */
  const scanPaused = useRef(false);
  scanPaused.current =
    (paymentOpen && !completedSale) || controlModal !== null || newScan !== '' || noBarcodeOpen;

  // A scanner types the whole barcode in a few milliseconds. Those keys are caught here before
  // they reach the search box, so the number never shows and no list pops up: the item goes
  // straight into the current sale. Digits typed by hand (slower) go into the search box as usual.
  useEffect(() => {
    let buffer = '';
    let last = 0;
    let fast = true;
    let timer = 0;
    const flush = () => {
      window.clearTimeout(timer);
      const code = buffer;
      buffer = '';
      if (!code) return;
      if (fast && code.length >= SCAN_MIN_LENGTH) onScan.current(code);
      else setQuery((current) => current + code);
    };
    function onKeyDown(event: KeyboardEvent) {
      if (scanPaused.current || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const inSearch = target instanceof HTMLInputElement && target.name === 'product-search';
      const inOtherField =
        !inSearch &&
        !!target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (inOtherField) return;
      const now = performance.now();
      if (/^\d$/.test(event.key)) {
        if (!buffer) fast = true;
        else if (now - last > SCAN_KEY_GAP_MS) fast = false;
        buffer += event.key;
        last = now;
        event.preventDefault();
        event.stopPropagation();
        window.clearTimeout(timer);
        timer = window.setTimeout(flush, SCAN_IDLE_MS);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && buffer) {
        // Most scanners end with Enter (some with Tab): the code is complete.
        event.preventDefault();
        event.stopPropagation();
        flush();
        return;
      }
      if (buffer) flush(); // a letter after digits: someone is typing a name
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(timer);
    };
  }, []);

  function addProduct(product: PosProduct) {
    // No selling price yet: ask for it instead of selling at ₱0.
    if (product.needsPrice) {
      setPricing(product);
      return;
    }
    // An unregistered product has no counted stock yet: it is sold without a stock limit.
    if (product.unregistered) product = { ...product, stock: undefined };
    if (product.stock !== undefined && product.stock < 1) {
      showToast(`${product.product} is out of stock.`, 'error');
      return;
    }
    const existing = cart.find((line) => matchesCartLine(line.product, product));
    if (existing && product.stock !== undefined && existing.quantity >= product.stock) {
      showToast(`Only ${product.stock} ${product.unit.toLowerCase()}s are available.`, 'error');
      return;
    }
    setCart((current) =>
      current.some((line) => matchesCartLine(line.product, product))
        ? current.map((line) =>
            matchesCartLine(line.product, product)
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [...current, { product, quantity: 1 }],
    );
    setLastAdded(product.barcode);
    setAddPulse((count) => count + 1);
    playSound('tap');
    setQuery('');
    setExpandedProduct(null);
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[name="product-search"]')?.focus(),
    );
  }

  function changeQuantity(barcodeValue: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.product.barcode !== barcodeValue) return [line];
        const quantity = line.quantity + delta;
        if (quantity < 1) return [];
        if (
          !line.product.unregistered &&
          line.product.stock !== undefined &&
          quantity > line.product.stock
        ) {
          showToast(
            `Only ${line.product.stock} ${line.product.unit.toLowerCase()}s are available.`,
            'error',
          );
          return [line];
        }
        return [{ ...line, quantity }];
      }),
    );
  }

  function clearSale() {
    setCart([]);
    setSelectedLine(null);
    setDiscountInput('0');
    showToast('All scanned items cleared.', 'info');
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[name="product-search"]')?.focus(),
    );
  }

  function removeSelectedItem() {
    if (!selectedLine) {
      showToast('Select an item in the current sale first.', 'info');
      return;
    }
    const removed = cart.find((line) => line.product.barcode === selectedLine);
    setCart((current) => current.filter((line) => line.product.barcode !== selectedLine));
    setSelectedLine(null);
    if (removed) showToast(`${removed.product.product} removed from the sale.`, 'info');
  }

  function stepSelectedQuantity(delta: number) {
    if (!selectedLine) {
      showToast('Select an item in the current sale first.', 'info');
      return;
    }
    changeQuantity(selectedLine, delta);
  }

  function openVoidDialog() {
    const session = getSession();
    const since = session ? new Date(session.openedAt) : new Date(new Date().toDateString());
    const latest = readSales()
      .filter((sale) => sale.status !== 'Voided' && new Date(sale.date) >= since)
      .slice(0, VOID_LIST_LIMIT);
    if (!latest.length) {
      showToast(
        session ? 'No sales in this shift to void yet.' : 'No sales today to void yet.',
        'info',
      );
      return;
    }
    setRecentSales(latest);
    setVoidTarget(latest[0].receipt);
    setVoidReason('');
    setControlModal('void');
  }

  /** Refreshes the stock counts and the sales copy after the server recorded a change. */
  async function refreshAfterSale() {
    try {
      await syncAfterSale();
      setProducts(getInventory());
    } catch {
      // The sale is saved on the server; the next refresh shows the new counts.
    }
  }

  /** The server's answer, in the shape the sales record on screen shows. */
  function shownSale(sale: ApiSale, lines: CartLine[]): CompletedSale {
    return {
      receipt: sale.receipt,
      date: sale.date,
      lines,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      payment: sale.payment,
      amountPaid: sale.amountPaid,
      change: sale.change,
      customer: sale.customer,
      reference: sale.gcashReference,
      cashier: sale.cashier,
      paymentStatus: sale.paymentStatus,
      creditBalance: sale.creditBalance,
      noChargeReason: sale.noChargeReason,
    };
  }

  /** Sale lines for the server; null (with a message) if an item is not on the server yet. */
  function serverLines(): NewSale['lines'] | null {
    const missing = cart.find((line) => !line.product.id);
    if (missing) {
      showToast(
        `${missing.product.product} is not saved on the server yet. Open it in Products and save it first.`,
        'error',
      );
      return null;
    }
    return cart.map((line) => ({ productId: line.product.id!, quantity: line.quantity }));
  }

  async function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = voidReason.trim();
    if (!voidTarget || !reason || saving) return;
    const target = readSales().find((sale) => sale.receipt === voidTarget);
    if (!target?.id) {
      showToast('That transaction could not be found.', 'error');
      return;
    }
    setSaving(true);
    try {
      await voidSale(target.id, reason);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The void was not saved.', 'error');
      return;
    } finally {
      setSaving(false);
    }
    await refreshAfterSale();
    // The sale on the counter is left as it is.
    setControlModal(null);
    setVoidReason('');
    showToast(`Sale ${voidTarget} voided. ${voidMoneyNote(target)}`, 'success');
  }

  function openNoChargeDialog() {
    if (!cart.length) {
      showToast('Add the items first, then mark them as no charge.', 'info');
      return;
    }
    setNoChargeReason('');
    setControlModal('charge');
  }

  async function submitNoCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = noChargeReason.trim();
    if (!reason || !cart.length || saving) return;
    const lines = serverLines();
    if (!lines) return;
    const saleLines = cart.map((line) => ({ ...line }));
    setSaving(true);
    let sale: ApiSale;
    try {
      sale = await createSale({ lines, payment: 'no_charge', noChargeReason: reason });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The record was not saved.', 'error');
      return;
    } finally {
      setSaving(false);
    }
    setCompletedSale(shownSale(sale, saleLines));
    setControlModal(null);
    setNoChargeReason('');
    setCart([]);
    setSelectedLine(null);
    setDiscountInput('0');
    setPaymentOpen(true);
    playSound('success');
    showToast(`No-charge record ${sale.receipt} saved.`, 'success');
    void refreshAfterSale();
  }

  async function completeSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completedSale || !cart.length || paymentBlocker || saving) return;
    const lines = serverLines();
    if (!lines) return;
    const saleLines = cart.map((line) => ({ ...line }));
    const paid = Number(tendered || 0);
    setSaving(true);
    let sale: ApiSale;
    try {
      sale = await createSale({
        lines,
        discountAmount: discount,
        ...(paymentMethod === 'Cash'
          ? { payment: 'cash', amountTendered: paid }
          : paymentMethod === 'GCash'
            ? { payment: 'gcash', gcashReference: gcashReference.trim(), gcashPaid }
            : { payment: 'credit', customerName: creditCustomer.trim(), downPayment: paid }),
      });
    } catch (error) {
      // Nothing was saved (the server records all of a sale or none of it): fix and try again.
      showToast(error instanceof Error ? error.message : 'The sale was not saved.', 'error');
      return;
    } finally {
      setSaving(false);
    }
    setCompletedSale(shownSale(sale, saleLines));
    setCart([]);
    setTendered('');
    setCreditCustomer('');
    setGcashReference('');
    setGcashPaid(false);
    setPaymentMethod('Cash');
    playSound('success');
    showToast(`Transaction ${sale.receipt} completed.`, 'success');
    void refreshAfterSale();
  }

  return (
    <div className="cashier-page cashier-pos-page">
      <div className="pos-layout">
        <section
          className="cashier-panel pos-order-panel pos-ticket"
          aria-labelledby="pos-sale-heading"
        >
          <header className="pos-ticket__head">
            <div>
              <span className={`pos-ticket__state${transactionActive ? ' is-open' : ''}`}>
                {transactionActive ? 'Sale in progress' : 'Ready for the next customer'}
              </span>
              <h3 id="pos-sale-heading">Current sale</h3>
            </div>
            <div className="pos-ticket__tools">
              <button
                className={`pos-price-check${priceCheck ? ' is-on' : ''}`}
                type="button"
                aria-pressed={priceCheck}
                title={
                  priceCheck
                    ? 'Price check is on: scans show the price and are not added. Click to turn it off.'
                    : 'Turn on to check a price: scans show the product and price without adding it.'
                }
                onClick={() => {
                  setPriceCheck((on) => !on);
                  setChecked(null);
                  document.querySelector<HTMLInputElement>('input[name="product-search"]')?.focus();
                }}
              >
                <CashierIcon name="search" />
                <span>{priceCheck ? 'Price check on' : 'Price check'}</span>
              </button>
              <button
                className="pos-price-check pos-no-barcode"
                type="button"
                title="Add an item that has no barcode, or one that will not scan"
                onClick={() => setNoBarcodeOpen(true)}
                disabled={priceCheck}
              >
                <span aria-hidden="true">＋</span>
                <span>No barcode</span>
              </button>
            </div>
          </header>
          <div className="pos-scan-dock pos-ticket__scan">
            <div className="pos-scan-field">
              <CashierIcon name="search" />
              <input
                name="product-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  const typed = event.currentTarget.value.trim();
                  if (event.key !== 'Enter' || !typed) return;
                  event.preventDefault();
                  scanOrPick(typed);
                }}
                placeholder={
                  scannerOff
                    ? 'Scanner off: type the product name'
                    : 'Scanner not working? Type the product name or barcode'
                }
                aria-label="Search a product by name or barcode"
                autoComplete="off"
                autoFocus
              />
              {scannerOff ? (
                <span
                  className="pos-scanner-sign is-off"
                  role="status"
                  title="The barcode scanner is off until the subscription is paid"
                >
                  <span className="pos-scanner-sign__dot" aria-hidden="true" />
                  Scanner off
                </span>
              ) : priceCheck ? (
                <span className="pos-scanner-sign is-check" role="status">
                  <span className="pos-scanner-sign__dot" aria-hidden="true" />
                  Checking prices
                </span>
              ) : (
                <span
                  className={`pos-scanner-sign${addPulse ? ' is-hit' : ''}`}
                  key={addPulse}
                  role="status"
                  aria-label={addPulse ? 'Item added' : 'Scanner ready'}
                  title="The scanner is always ready on this page"
                >
                  <span className="pos-scanner-sign__dot" aria-hidden="true" />
                  {addPulse ? 'Added' : 'Scanner ready'}
                </span>
              )}
            </div>
            {query.trim() && (
              <div className="pos-scan-results" aria-live="polite">
                {filteredProducts.slice(0, 6).map((product) => (
                  <button
                    key={product.barcode}
                    className="pos-scan-result"
                    type="button"
                    onClick={() => {
                      if (!priceCheck) return addProduct(product);
                      setChecked(product);
                      setQuery('');
                    }}
                    disabled={!priceCheck && !product.unregistered && product.stock < 1}
                  >
                    <span>
                      <strong>{product.product}</strong>
                      <small>
                        {product.detail} · {product.noBarcode ? 'No barcode' : product.barcode}
                      </small>
                    </span>
                    <span>
                      <b>{product.price}</b>
                      <small>
                        {product.unregistered
                          ? 'New · not registered'
                          : product.stock > 0
                            ? `${product.stock} left`
                            : 'Out of stock'}
                      </small>
                    </span>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="pos-scan-empty">No products match this search.</p>
                )}
              </div>
            )}
            {priceCheck && !query.trim() && (
              <div className="pos-price-card" aria-live="polite">
                {checked ? (
                  <>
                    <div className="pos-price-card__item">
                      <strong>{checked.product}</strong>
                      <small>{checked.detail}</small>
                      <small>
                        {checked.barcode} ·{' '}
                        {checked.stock > 0
                          ? `${checked.stock} ${checked.unit.toLowerCase()}s left`
                          : 'Out of stock'}
                      </small>
                    </div>
                    <div className="pos-price-card__price">
                      <b>{formatMoney(toAmount(checked.price))}</b>
                      <small>per {checked.unit.toLowerCase()}</small>
                      <button
                        type="button"
                        disabled={checked.stock < 1}
                        onClick={() => addProduct(checked)}
                      >
                        Add to sale
                      </button>
                    </div>
                  </>
                ) : (
                  <p>
                    Scan an item to see its price. Nothing is added to the sale while this is on.
                  </p>
                )}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <div className="pos-ticket__cols" aria-hidden="true">
              <span>#</span>
              <span>Item</span>
              <span>Qty</span>
              <span>Amount</span>
            </div>
          )}
          <div className="pos-ticket__lines">
            {cart.map(({ product, quantity }, index) => (
              <div
                className={`pos-ticket-line${selectedLine === product.barcode ? ' is-selected' : ''}${
                  lastAdded === product.barcode ? ' is-latest' : ''
                }`}
                key={product.barcode}
                onClick={() => setSelectedLine(product.barcode)}
              >
                {lastAdded === product.barcode && (
                  // A new key on every add replays the flash, also for the same item again.
                  <span className="pos-ticket-line__flash" key={addPulse} aria-hidden="true" />
                )}
                <span className="pos-ticket-line__no">{String(index + 1).padStart(2, '0')}</span>
                <div className="pos-ticket-line__name">
                  <strong>
                    {product.product}
                    {product.unregistered && (
                      <span className="pos-ticket-line__new" title="Not on the product list yet">
                        New
                      </span>
                    )}
                  </strong>
                  <small>
                    {formatMoney(toAmount(product.price))} / {product.unit}
                  </small>
                </div>
                <div className="pos-ticket-qty">
                  <button
                    type="button"
                    aria-label={`Decrease ${product.product}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      changeQuantity(product.barcode, -1);
                    }}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.product}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      changeQuantity(product.barcode, 1);
                    }}
                  >
                    +
                  </button>
                </div>
                <strong className="pos-ticket-line__amount">
                  {formatMoney(toAmount(product.price) * quantity)}
                </strong>
              </div>
            ))}
            {!cart.length && (
              <div className="pos-ticket__empty is-active">
                <strong>Scan the first item.</strong>
                <span>
                  The scanner is always ready here. If it does not work, type the product name or
                  barcode in the box above.
                </span>
              </div>
            )}
          </div>
          <div className="pos-ticket__totals">
            <div className="pos-ticket__row">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div className="pos-ticket__row">
              <span>Discount</span>
              <label className="pos-ticket__discount">
                <span>₱</span>
                <input
                  aria-label="Discount amount in pesos"
                  type="text"
                  inputMode="decimal"
                  value={discountInput}
                  placeholder="0.00"
                  maxLength={9}
                  onChange={(event) => setDiscountInput(sanitizeDiscountInput(event.target.value))}
                  onBlur={() => setDiscountInput(discountInput ? String(discount) : '0')}
                />
              </label>
            </div>
            {discountTooBig && (
              <p className="pos-ticket__discount-warn" role="alert">
                The discount is more than the items cost. It is set to {formatMoney(subtotal)}.
              </p>
            )}
            {discount > 0 && (
              <div className="pos-ticket__row">
                <span>Less discount</span>
                <strong>−{formatMoney(discount)}</strong>
              </div>
            )}
            <div className="pos-ticket__due">
              <span>Total due</span>
              <strong>{formatMoney(totalDue)}</strong>
            </div>
          </div>
          <div className="pos-ticket__foot">
            <button
              className="pos-ticket__pay"
              type="button"
              disabled={!cart.length || !shiftOpen}
              onClick={() => setPaymentOpen(true)}
            >
              <span>Continue to payment</span>
              <CashierIcon name="arrow" />
            </button>
            {!shiftOpen ? (
              <p className="pos-ticket__notice" role="status">
                No shift is open. Press <b>Start shift</b> at the top before taking payment.
              </p>
            ) : (
              cart.length > 0 && (
                <p className="pos-ticket__hint">
                  Press <kbd>Enter</kbd> to continue to payment.
                </p>
              )
            )}
          </div>
        </section>
        <aside className="cashier-panel pos-control-center" aria-labelledby="pos-control-heading">
          <div className="cashier-panel__heading">
            <div>
              <h3 id="pos-control-heading">Sale controls</h3>
              <p>
                {transactionActive
                  ? selectedLine
                    ? 'An item is selected in the current sale.'
                    : 'Click an item in the current sale to select it.'
                  : 'Scan an item to start a sale.'}
              </p>
            </div>
            <button
              className={`pos-sound-switch${soundOn ? ' is-on' : ''}`}
              type="button"
              role="switch"
              aria-checked={soundOn}
              title={soundOn ? 'Turn counter sounds off' : 'Turn counter sounds on'}
              onClick={() => {
                const next = !soundOn;
                setSoundEnabled(next);
                setSoundOn(next);
                // Play a sample when turning sound on, so the cashier hears it works.
                if (next) playSound('tap');
              }}
            >
              <CashierIcon name={soundOn ? 'sound' : 'mute'} />
              <span>Sound {soundOn ? 'on' : 'off'}</span>
            </button>
          </div>
          <div className="pos-control-grid">
            <button
              className="pos-control-button"
              type="button"
              disabled={!transactionActive || !cart.length}
              onClick={() => {
                playSound('warn');
                clearSale();
              }}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="trash" />
              </span>
              <span className="pos-control-button__text">
                <strong>Clear sale</strong>
                <small>Remove every item</small>
              </span>
            </button>
            <button
              className="pos-control-button"
              type="button"
              disabled={!transactionActive || !cart.length}
              onClick={() => {
                playSound('warn');
                removeSelectedItem();
              }}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="close" />
              </span>
              <span className="pos-control-button__text">
                <strong>Delete item</strong>
                <small>Drop this item</small>
              </span>
            </button>
            <button
              className="pos-control-button"
              type="button"
              disabled={!transactionActive || !selectedLine}
              onClick={() => {
                playSound('tap');
                stepSelectedQuantity(-1);
              }}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="minus" />
              </span>
              <span className="pos-control-button__text">
                <strong>Quantity −</strong>
                <small>One less</small>
              </span>
            </button>
            <button
              className="pos-control-button"
              type="button"
              disabled={!transactionActive || !selectedLine}
              onClick={() => {
                playSound('tap');
                stepSelectedQuantity(1);
              }}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="plus" />
              </span>
              <span className="pos-control-button__text">
                <strong>Quantity +</strong>
                <small>One more</small>
              </span>
            </button>
            <button
              className="pos-control-button"
              type="button"
              onClick={() => {
                playSound('warn');
                openVoidDialog();
              }}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="receipt" />
              </span>
              <span className="pos-control-button__text">
                <strong>Void sale</strong>
                <small>Correct a sale</small>
              </span>
            </button>
            <button
              className="pos-control-button pos-control-button--no-charge"
              type="button"
              disabled={!transactionActive || !cart.length}
              onClick={() => {
                playSound('tap');
                openNoChargeDialog();
              }}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="nocharge" />
              </span>
              <span className="pos-control-button__text">
                <strong>Don't charge</strong>
                <small>Own use, no payment</small>
              </span>
            </button>
          </div>
        </aside>
      </div>
      {noBarcodeOpen && (
        <NoBarcodeItem
          onCancel={() => setNoBarcodeOpen(false)}
          onAdded={(product) => {
            setNoBarcodeOpen(false);
            setProducts(getInventory());
            addProduct(product);
            if (product.unregistered) {
              showToast(`${product.product} added. Register it later in Products › Unregistered.`);
            }
          }}
        />
      )}
      {pricing && (
        <SetPriceItem
          product={{ ...pricing, stock: pricing.stock ?? 0, status: 'In Stock' }}
          onCancel={() => setPricing(null)}
          onPriced={(product) => {
            setPricing(null);
            setProducts(getInventory());
            addProduct(product);
            showToast(`${product.product} now sells at ${product.price}.`);
          }}
        />
      )}
      {newScan && (
        <ScannedNewProduct
          key={newScan}
          barcode={newScan}
          onCancel={() => setNewScan('')}
          onAdded={(product) => {
            setNewScan('');
            setProducts(getInventory());
            addProduct(product);
            showToast(`${product.product} added to the sale. Register it later in Products.`);
          }}
        />
      )}
      {controlModal && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setControlModal(null);
          }}
        >
          {controlModal === 'void' ? (
            <form className="pos-payment-modal pos-control-modal pos-void" onSubmit={submitVoid}>
              <button
                className="pos-modal-close"
                type="button"
                onClick={() => setControlModal(null)}
                aria-label="Close void sale"
              >
                ×
              </button>
              <p className="eyebrow">Correction</p>
              <h2>Void a sale</h2>
              <p className="pos-control-modal__note">
                Pick the sale to cancel. Its items go back on the shelf and it stops counting in the
                shift totals. The sale on the counter is not touched.
              </p>
              <div className="pos-void__body">
                <fieldset className="pos-void__list">
                  <legend>
                    {getSession() ? 'Sales this shift' : 'Sales today'} · newest first
                  </legend>
                  {recentSales.map((sale) => (
                    <label
                      key={sale.receipt}
                      className={`pos-void__option${voidTarget === sale.receipt ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="void-target"
                        checked={voidTarget === sale.receipt}
                        onChange={() => setVoidTarget(sale.receipt)}
                      />
                      <span className="pos-void__mark" aria-hidden="true" />
                      <span className="pos-void__main">
                        <strong>{sale.receipt}</strong>
                        <small>
                          {new Date(sale.date).toLocaleTimeString('en-PH', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}{' '}
                          · {sale.payment ?? 'Cash'} · {sale.items ?? 0} item
                          {Number(sale.items ?? 0) === 1 ? '' : 's'}
                        </small>
                      </span>
                      <b>{formatMoney(Number(sale.total ?? 0))}</b>
                    </label>
                  ))}
                </fieldset>
                {(() => {
                  const sale = recentSales.find((item) => item.receipt === voidTarget);
                  if (!sale) return null;
                  return (
                    <section className="pos-void__detail" aria-label={`Items on ${sale.receipt}`}>
                      <header>
                        <span>Record</span>
                        <strong>{sale.receipt}</strong>
                        <small>{formatReceiptDate(sale.date)}</small>
                      </header>
                      <ul>
                        {(sale.lines ?? []).map((line) => (
                          <li key={line.barcode}>
                            <span>
                              {line.quantity} × {line.product}
                            </span>
                            <b>{formatMoney(line.quantity * line.unitPrice)}</b>
                          </li>
                        ))}
                        {!sale.lines?.length && <li>No item details were saved for this sale.</li>}
                      </ul>
                      <div className="pos-void__total">
                        <span>Total</span>
                        <strong>{formatMoney(Number(sale.total ?? 0))}</strong>
                      </div>
                      <p className="pos-void__money">{voidMoneyNote(sale)}</p>
                    </section>
                  );
                })()}
              </div>
              <div className="pos-void__reason">
                <span id="void-reason-label">Reason for voiding</span>
                <div className="pos-void__chips" role="group" aria-labelledby="void-reason-label">
                  {VOID_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={voidReason === reason ? 'is-picked' : undefined}
                      aria-pressed={voidReason === reason}
                      onClick={() => setVoidReason(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-labelledby="void-reason-label"
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  placeholder="Or write what happened"
                  rows={2}
                  required
                />
              </div>
              <div className="pos-void__actions">
                <button
                  className="pos-void__cancel"
                  type="button"
                  onClick={() => setControlModal(null)}
                >
                  Keep the sale
                </button>
                <button
                  className="pos-void__submit"
                  type="submit"
                  disabled={!voidTarget || !voidReason.trim() || saving}
                >
                  {saving ? 'Saving…' : `Void ${voidTarget || 'sale'}`}
                </button>
              </div>
            </form>
          ) : (
            <form className="pos-payment-modal pos-control-modal" onSubmit={submitNoCharge}>
              <button
                className="pos-modal-close"
                type="button"
                onClick={() => setControlModal(null)}
                aria-label="Close no charge"
              >
                ×
              </button>
              <p className="eyebrow">No charge</p>
              <h2>Release items without charging</h2>
              <p className="pos-control-modal__note">
                {totalItems} item{totalItems === 1 ? '' : 's'} worth {formatMoney(subtotal)} will
                leave stock and a record is still saved. A reason is required.
              </p>
              <label>
                Reason
                <textarea
                  value={noChargeReason}
                  onChange={(event) => setNoChargeReason(event.target.value)}
                  placeholder="Example: owner's personal use, staff medical kit"
                  rows={3}
                  required
                />
              </label>
              <button
                className="pos-checkout-button pos-control-modal__submit"
                type="submit"
                disabled={!noChargeReason.trim() || saving}
              >
                {saving ? 'Saving…' : 'Save no-charge record'}
              </button>
            </form>
          )}
        </div>
      )}
      {paymentOpen && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePayment();
          }}
        >
          <form
            className={`pos-payment-modal ${completedSale ? 'pos-payment-modal--done' : 'pos-payment-modal--collect'}`}
            onSubmit={completeSale}
          >
            <button
              className="pos-modal-close"
              type="button"
              onClick={closePayment}
              aria-label="Close payment"
            >
              ×
            </button>
            {completedSale ? (
              <SaleComplete sale={completedSale} onDone={closePayment} />
            ) : (
              <>
                <div className="pos-pay">
                  <section className="pos-pay__order" aria-label="Order summary">
                    <p className="eyebrow">Payment</p>
                    <h2>Collect payment</h2>
                    <ul className="pos-pay__lines">
                      {cart.map(({ product, quantity }) => (
                        <li key={product.barcode}>
                          <span>
                            <b>{quantity}×</b> {product.product}
                          </span>
                          <span>{formatMoney(toAmount(product.price) * quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pos-pay__sums">
                      <div>
                        <span>
                          Subtotal · {totalItems} item{totalItems === 1 ? '' : 's'}
                        </span>
                        <span>{formatMoney(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div>
                          <span>Discount</span>
                          <span>−{formatMoney(discount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="pos-pay__due">
                      <span>Total due</span>
                      <strong>{formatMoney(totalDue)}</strong>
                    </div>
                  </section>

                  <section className="pos-pay__collect" aria-label="Payment">
                    <div className="pos-pay__methods" role="radiogroup" aria-label="Payment method">
                      {PAYMENT_METHOD_OPTIONS.map((method) => (
                        <button
                          key={method.id}
                          className={`pos-pay__method${paymentMethod === method.id ? ' is-selected' : ''}`}
                          type="button"
                          role="radio"
                          aria-checked={paymentMethod === method.id}
                          onClick={() => selectPaymentMethod(method.id)}
                        >
                          <CashierIcon name={method.icon} />
                          <span>
                            <strong>{method.name}</strong>
                            <small>{method.detail}</small>
                          </span>
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'Cash' && (
                      <div className="pos-pay__panel">
                        <label className="pos-pay__field">
                          <span>Cash received</span>
                          <span className="pos-pay__money">
                            <i aria-hidden="true">₱</i>
                            <input
                              autoFocus
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={tendered}
                              onChange={(event) =>
                                setTendered(sanitizeMoneyInput(event.target.value))
                              }
                              placeholder="0.00"
                              required
                            />
                          </span>
                        </label>
                        <div className="pos-pay__quick" role="group" aria-label="Quick amounts">
                          {quickCashAmounts(totalDue).map((amount, index) => (
                            <button
                              key={amount}
                              type="button"
                              className={Number(tendered) === amount ? 'is-picked' : undefined}
                              onClick={() => setTendered(amount.toFixed(2))}
                            >
                              {index === 0 ? 'Exact' : formatMoney(amount).replace('.00', '')}
                            </button>
                          ))}
                        </div>
                        <div
                          className={`pos-pay__result${
                            tendered && Number(tendered) < totalDue ? ' is-short' : ''
                          }`}
                        >
                          <span>
                            {tendered && Number(tendered) < totalDue ? 'Still short' : 'Change'}
                          </span>
                          <strong>
                            {formatMoney(
                              tendered && Number(tendered) < totalDue
                                ? totalDue - Number(tendered)
                                : change,
                            )}
                          </strong>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'GCash' && (
                      <div className="pos-pay__panel">
                        <div className="pos-pay__gcash">
                          <div className="pos-pay__gcash-send">
                            <span>Customer sends</span>
                            <strong>{formatMoney(totalDue)}</strong>
                            <span>to this GCash number</span>
                          </div>
                          {gcashDetails.number ? (
                            <p className="pos-pay__gcash-number" aria-label="Pharmacy GCash number">
                              {formatGcashNumber(gcashDetails.number)}
                            </p>
                          ) : (
                            <p className="pos-pay__gcash-missing">
                              No GCash number is set yet. Add it in Owner → Pharmacy settings.
                            </p>
                          )}
                          {gcashDetails.qrUrl && (
                            <img src={gcashDetails.qrUrl} alt="Pharmacy GCash QR code" />
                          )}
                        </div>
                        <label className="pos-pay__field">
                          <span>GCash ref. no. (at least the last 3 digits)</span>
                          <input
                            value={gcashReference}
                            onChange={(event) =>
                              setGcashReference(event.target.value.replace(/\D/g, '').slice(0, 13))
                            }
                            placeholder="e.g. 482"
                            inputMode="numeric"
                            autoComplete="off"
                            required
                          />
                        </label>
                        <label className="pos-pay__confirm">
                          <input
                            type="checkbox"
                            checked={gcashPaid}
                            onChange={(event) => setGcashPaid(event.target.checked)}
                          />
                          Payment confirmed
                        </label>
                      </div>
                    )}
                    {paymentMethod === 'Credit' && (
                      <div className="pos-pay__panel">
                        <CustomerNameField value={creditCustomer} onChange={setCreditCustomer} />
                        <label className="pos-pay__field">
                          <span>Cash paid now (optional)</span>
                          <span className="pos-pay__money">
                            <i aria-hidden="true">₱</i>
                            <input
                              name="credit-amount-paid"
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={tendered}
                              onChange={(event) =>
                                setTendered(sanitizeMoneyInput(event.target.value))
                              }
                              placeholder="0.00"
                            />
                          </span>
                        </label>
                        <div
                          className={`pos-pay__result is-credit${
                            Number(tendered) > totalDue ? ' is-short' : ''
                          }`}
                        >
                          <span>
                            {Number(tendered) > totalDue ? 'More than the total' : 'Utang balance'}
                          </span>
                          <strong>{formatMoney(creditBalance)}</strong>
                        </div>
                      </div>
                    )}

                    <button
                      className="pos-pay__submit"
                      type="submit"
                      disabled={Boolean(paymentBlocker) || saving}
                    >
                      {saving
                        ? 'Saving…'
                        : paymentMethod === 'Cash'
                          ? `Complete cash sale${change > 0 && !paymentBlocker ? ` · change ${formatMoney(change)}` : ''}`
                          : paymentMethod === 'GCash'
                            ? gcashPaid
                              ? 'Complete GCash sale'
                              : 'Save as pending GCash'
                            : 'Save as utang'}
                    </button>
                    <p className="pos-pay__status" aria-live="polite">
                      {paymentBlocker || (
                        <>
                          Press <kbd>Enter</kbd> to save. It records the sale and takes the items
                          out of stock.
                        </>
                      )}
                    </p>
                  </section>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

type UtangCustomer = {
  name: string;
  balance: number;
  lastDate: string;
  lastAmount: number;
};

/** Customers with utang (open or paid), from the sales copy, with their balance and last utang. */
function readUtangCustomers(): UtangCustomer[] {
  const byName = new Map<string, UtangCustomer>();
  for (const sale of readSales()) {
    const name = sale.customer?.trim();
    if (sale.payment !== 'Credit' || sale.status === 'Voided' || !name) continue;
    const key = name.toLowerCase();
    const customer = byName.get(key) ?? { name, balance: 0, lastDate: '', lastAmount: 0 };
    customer.balance += Number(sale.creditBalance ?? 0);
    if (sale.date > customer.lastDate) {
      customer.lastDate = sale.date;
      customer.lastAmount = Number(sale.total ?? 0);
    }
    byName.set(key, customer);
  }
  return [...byName.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

/**
 * Utang customer name: type a new name, or pick an existing customer from the list that shows
 * while typing (with their balance and last utang), so one person keeps one account.
 */
function CustomerNameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [customers] = useState(readUtangCustomers);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const needle = value.trim().toLowerCase();
  const matches = needle
    ? customers.filter((customer) => customer.name.toLowerCase().includes(needle)).slice(0, 6)
    : [];
  const picked = customers.find((customer) => customer.name.toLowerCase() === needle);
  const showList = open && matches.length > 0 && !(picked && matches.length === 1);
  const describe = (customer: UtangCustomer) =>
    `Balance ${formatMoney(customer.balance)} · last utang ${new Date(
      customer.lastDate,
    ).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} (${formatMoney(customer.lastAmount)})`;

  function pick(customer: UtangCustomer) {
    onChange(customer.name);
    setOpen(false);
  }

  return (
    <div className="pos-pay__field pos-customer-pick">
      <span>Customer name</span>
      <input
        name="credit-customer"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter') {
            // Enter picks the highlighted customer; the next Enter saves the sale.
            event.preventDefault();
            pick(matches[active]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls="pos-customer-list"
        aria-autocomplete="list"
        aria-label="Customer name"
        autoComplete="off"
        placeholder="Type a name, or pick an existing customer"
        required
        autoFocus
      />
      {showList && (
        <ul className="pos-customer-pick__list" id="pos-customer-list" role="listbox">
          {matches.map((customer, index) => (
            <li key={customer.name} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={index === active ? 'is-active' : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(customer)}
              >
                <strong>{customer.name}</strong>
                <small>{describe(customer)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!showList && picked && (
        <small className="pos-customer-pick__note is-existing">{describe(picked)}</small>
      )}
      {!showList && needle && !picked && (
        <small className="pos-customer-pick__note">New customer: a new utang account starts.</small>
      )}
    </div>
  );
}

/**
 * After a sale: the check mark and the change stay on screen until Close or Enter, then the
 * counter is ready for the next customer. The sales record is in Transactions.
 */
function SaleComplete({ sale, onDone }: { sale: CompletedSale; onDone: () => void }) {
  return (
    <div className="pos-done is-final">
      <div className="pos-done__check" aria-live="polite">
        <span className="pos-done__badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.6 9.6 17 19 7.4"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <strong>
          {sale.payment === 'No charge'
            ? 'No-charge record saved'
            : sale.payment === 'Credit'
              ? 'Utang saved'
              : 'Payment complete'}
        </strong>
        {sale.change > 0 && (
          <span className="pos-done__change">Change {formatMoney(sale.change)}</span>
        )}
        <span className="pos-done__record">{sale.receipt}</span>
      </div>

      <div className="pos-done__actions">
        <button className="pos-done__close" type="button" onClick={onDone} autoFocus>
          Close
        </button>
      </div>
      <p className="pos-done__hint">
        Press <kbd>Enter</kbd> or scan the next item for the next customer.
      </p>
    </div>
  );
}
function matchesCartLine(left: PosProduct, right: PosProduct): boolean {
  if (left.localProductId !== undefined && right.localProductId !== undefined) {
    return (
      left.localProductId === right.localProductId &&
      left.localProductUnitId === right.localProductUnitId
    );
  }
  return left.barcode === right.barcode;
}
