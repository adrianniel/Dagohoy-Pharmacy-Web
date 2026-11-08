import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import { loadMovements, saveMovements } from '../../data/operationsStore';
import { getWorkspaceProfile } from '../../data/accountStore';
import { REGISTER_SESSION_KEY, getSession } from '../../data/registerSession';

type CatalogProduct = ReturnType<typeof getInventory>[number];
type PosProduct = Omit<CatalogProduct, 'stock' | 'status'> & {
  stock?: number;
  localProductId?: number;
  localProductUnitId?: number | null;
};
type CartLine = { product: PosProduct; quantity: number };
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
  receipt: string;
  date: string;
  items?: number;
  total?: number;
  subtotal?: number;
  discount?: number;
  payment?: string;
  status?: string;
  creditBalance?: number;
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
const SALES_KEY = 'dagohoy_demo_sales';
const VOID_LOG_KEY = 'dagohoy_demo_void_log';
type VoidRecord = { receipt: string; date: string; reason: string; cashier: string; total: number };

function readSales(): StoredSale[] {
  return JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as StoredSale[];
}

function readVoidLog(): VoidRecord[] {
  try {
    return JSON.parse(localStorage.getItem(VOID_LOG_KEY) ?? '[]') as VoidRecord[];
  } catch {
    return [];
  }
}
const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';
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

function readCashierName(): string {
  try {
    const session = JSON.parse(localStorage.getItem(REGISTER_SESSION_KEY) ?? 'null') as {
      cashierName?: string;
    } | null;
    const sessionName = session?.cashierName?.trim();
    if (sessionName) return sessionName;
  } catch {
    // fall through to the account profile
  }
  return getWorkspaceProfile().name;
}

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
  const integerPart = (dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex)).slice(0, 3);
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
  return Number(next) > 100 ? '100' : next;
}

export function CashierPosPage() {
  const [products] = useState(getInventory);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [transactionActive, setTransactionActive] = useState(false);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState('0');
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
  const [controlModal, setControlModal] = useState<'void' | 'charge' | null>(null);
  const [voidTarget, setVoidTarget] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [recentSales, setRecentSales] = useState<StoredSale[]>([]);
  const [noChargeReason, setNoChargeReason] = useState('');
  const { showToast } = useToast();
  const subtotal = cart.reduce(
    (total, line) => total + toAmount(line.product.price) * line.quantity,
    0,
  );
  const discountPercent = Math.min(100, Math.max(0, Number(discountInput) || 0));
  const totalItems = cart.reduce((total, line) => total + line.quantity, 0);
  const discount = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
  const totalDue = subtotal - discount;
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.product} ${product.detail} ${product.barcode}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [products, query],
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
        ? !gcashReference.trim()
          ? 'Enter the GCash reference number from the customer.'
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

  function startTransaction() {
    setTransactionActive(true);
    setOpenedAt(new Date());
    setQuery('');
    setExpandedProduct(null);
    showToast('Transaction started. Scan or search for the first item.', 'info');
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[name="product-search"]')?.focus(),
    );
  }

  function addProduct(product: PosProduct) {
    if (!transactionActive) {
      showToast(
        'Start a transaction in the Current sale panel to add this item to the list.',
        'info',
      );
      return;
    }
    if (product.stock !== undefined && product.stock < 1) {
      showToast(`${product.product} is out of stock.`, 'error');
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => matchesCartLine(line.product, product));
      if (existing) {
        if (product.stock !== undefined && existing.quantity >= product.stock) {
          showToast(`Only ${product.stock} ${product.unit.toLowerCase()}s are available.`, 'error');
          return current;
        }
        return current.map((line) =>
          matchesCartLine(line.product, product) ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
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
        if (line.product.stock !== undefined && quantity > line.product.stock) {
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

  function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = voidReason.trim();
    if (!voidTarget || !reason) return;
    const sales = readSales();
    const target = sales.find((sale) => sale.receipt === voidTarget);
    if (!target) {
      showToast('That transaction could not be found.', 'error');
      return;
    }
    const stock = getInventory();
    const inventory = stock.map((product) => {
      const returned = (target.lines ?? []).find((line) => line.barcode === product.barcode);
      if (!returned) return product;
      const nextStock = product.stock + returned.quantity;
      return { ...product, stock: nextStock, status: stockStatus(nextStock) };
    });
    saveInventory(inventory);
    localStorage.setItem(
      SALES_KEY,
      JSON.stringify(
        sales.map((sale) =>
          sale.receipt === voidTarget
            ? {
                ...sale,
                status: 'Voided',
                creditBalance: 0,
                voidedAt: new Date().toISOString(),
                voidReason: reason,
              }
            : sale,
        ),
      ),
    );
    localStorage.setItem(
      VOID_LOG_KEY,
      JSON.stringify([
        {
          receipt: voidTarget,
          date: new Date().toISOString(),
          reason,
          cashier: readCashierName(),
          total: Number(target.total ?? 0),
        },
        ...readVoidLog(),
      ]),
    );
    const previousMovements = loadMovements();
    saveMovements([
      ...(target.lines ?? []).map((line) => ({
        id: `VOID-${voidTarget}-${line.barcode}`,
        date: new Date().toISOString(),
        product: line.product,
        kind: 'Adjustment' as const,
        change: line.quantity,
        reference: voidTarget,
        staff: readCashierName(),
        reason: `Voided sale: ${reason}`,
      })),
      ...previousMovements,
    ]);
    // The sale on the counter is left as it is; only open a ticket if none is open yet.
    setControlModal(null);
    setVoidReason('');
    if (!transactionActive) {
      setTransactionActive(true);
      setOpenedAt(new Date());
    }
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

  function submitNoCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = noChargeReason.trim();
    if (!reason || !cart.length) return;
    const receipt = `NC-${String(Date.now()).slice(-6)}`;
    const saleLines = cart.map((line) => ({ ...line }));
    const cashierName = readCashierName();
    const sales = readSales();
    sales.unshift({
      receipt,
      date: new Date().toISOString(),
      items: totalItems,
      total: 0,
      subtotal,
      discount: 0,
      payment: 'No charge',
      status: 'No charge',
      lines: saleLines.map((line) => ({
        product: line.product.product,
        barcode: line.product.barcode,
        quantity: line.quantity,
        unitPrice: toAmount(line.product.price),
      })),
    });
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
    const stock = getInventory();
    saveInventory(
      stock.map((product) => {
        const taken = cart.find((line) => line.product.barcode === product.barcode)?.quantity ?? 0;
        if (!taken) return product;
        const nextStock = Math.max(0, product.stock - taken);
        return { ...product, stock: nextStock, status: stockStatus(nextStock) };
      }),
    );
    saveMovements([
      ...cart.map((line) => ({
        id: `NOC-${receipt}-${line.product.barcode}`,
        date: new Date().toISOString(),
        product: line.product.product,
        kind: 'Sale' as const,
        change: -line.quantity,
        reference: receipt,
        staff: 'Cashier',
        reason: `No charge: ${reason}`,
      })),
      ...loadMovements(),
    ]);
    setCompletedSale({
      receipt,
      date: new Date().toISOString(),
      lines: saleLines,
      subtotal,
      discount: 0,
      total: 0,
      payment: 'No charge',
      amountPaid: 0,
      change: 0,
      cashier: cashierName,
      noChargeReason: reason,
    });
    setControlModal(null);
    setNoChargeReason('');
    setCart([]);
    setSelectedLine(null);
    setDiscountInput('0');
    setTransactionActive(false);
    setOpenedAt(null);
    setPaymentOpen(true);
    showToast(`No-charge slip ${receipt} recorded.`, 'success');
  }

  function completeSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completedSale || !cart.length) return;
    if (paymentMethod === 'Cash' && Number(tendered) < totalDue) return;
    if (
      paymentMethod === 'Credit' &&
      (!creditCustomer.trim() || Number(tendered) < 0 || Number(tendered) > totalDue)
    ) {
      return;
    }
    const sales = JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Array<
      Record<string, unknown>
    >;
    const receipt = `DP-${String(Date.now()).slice(-6)}`;
    const saleLines = cart.map((line) => ({ ...line }));
    const salePayment = paymentMethod;
    const cashierName = readCashierName();
    const amountPaidValue =
      salePayment === 'Cash' || salePayment === 'Credit'
        ? Number(tendered || 0)
        : gcashPaid
          ? totalDue
          : 0;
    sales.unshift({
      receipt,
      date: new Date().toISOString(),
      items: totalItems,
      total: totalDue,
      subtotal,
      discount,
      lines: cart.map((line) => ({
        product: line.product.product,
        barcode: line.product.barcode,
        quantity: line.quantity,
        unitPrice: toAmount(line.product.price),
      })),
      payment: salePayment,
      cashier: cashierName,
      customer: salePayment === 'Credit' ? creditCustomer.trim() : undefined,
      amountPaid: amountPaidValue,
      change: salePayment === 'Cash' ? change : 0,
      creditBalance: salePayment === 'Credit' ? creditBalance : 0,
      // Cash the credit customer paid now; it goes into the drawer this shift.
      downPayment: salePayment === 'Credit' ? amountPaidValue : undefined,
      gcashReference: salePayment === 'GCash' ? gcashReference.trim() : undefined,
      paymentStatus: salePayment === 'GCash' ? (gcashPaid ? 'Paid' : 'Unpaid') : undefined,
      status:
        salePayment === 'Credit' && creditBalance > 0
          ? 'Credit'
          : salePayment === 'GCash' && !gcashPaid
            ? 'Pending GCash'
            : 'Completed',
    });
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
    const inventory = getInventory();
    saveInventory(
      inventory.map((product) => {
        const sold = cart.find((line) => line.product.barcode === product.barcode)?.quantity ?? 0;
        const stock = Math.max(0, product.stock - sold);
        return sold ? { ...product, stock, status: stockStatus(stock) } : product;
      }),
    );
    const previousMovements = loadMovements();
    saveMovements([
      ...cart.map((line) => ({
        id: `SALE-${receipt}-${line.product.barcode}`,
        date: new Date().toISOString(),
        product: line.product.product,
        kind: 'Sale' as const,
        change: -line.quantity,
        reference: receipt,
        staff: 'Cashier',
        reason: 'Completed POS sale',
      })),
      ...previousMovements,
    ]);
    setCompletedSale({
      receipt,
      date: new Date().toISOString(),
      lines: saleLines,
      subtotal,
      discount,
      total: totalDue,
      payment: salePayment,
      amountPaid: amountPaidValue,
      change: salePayment === 'Cash' ? change : 0,
      customer: salePayment === 'Credit' ? creditCustomer.trim() : undefined,
      reference: salePayment === 'GCash' ? gcashReference.trim() : undefined,
      cashier: cashierName,
      paymentStatus: salePayment === 'GCash' ? (gcashPaid ? 'Paid' : 'Unpaid') : undefined,
      creditBalance: salePayment === 'Credit' ? creditBalance : 0,
    });
    setCart([]);
    setTransactionActive(false);
    setOpenedAt(null);
    setTendered('');
    setCreditCustomer('');
    setGcashReference('');
    setGcashPaid(false);
    setPaymentMethod('Cash');
    showToast(`Transaction ${receipt} completed.`, 'success');
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
                {transactionActive ? 'Ticket open' : 'No open ticket'}
              </span>
              <h3 id="pos-sale-heading">Current sale</h3>
            </div>
            <dl className="pos-ticket__meta">
              <div>
                <dt>Opened</dt>
                <dd>
                  {openedAt
                    ? openedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
                    : '--:--'}
                </dd>
              </div>
              <div>
                <dt>Lines</dt>
                <dd>{cart.length}</dd>
              </div>
              <div>
                <dt>Qty</dt>
                <dd>{totalItems}</dd>
              </div>
            </dl>
          </header>
          <div className="pos-scan-dock pos-ticket__scan">
            <label className="pos-scan-field">
              <CashierIcon name="search" />
              <input
                name="product-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                autoFocus
                disabled={!transactionActive}
                placeholder={
                  transactionActive
                    ? 'Scan a barcode or type a product name'
                    : 'Open a ticket to scan'
                }
              />
            </label>
            {query.trim() && transactionActive && (
              <div className="pos-scan-results" aria-live="polite">
                {filteredProducts.slice(0, 6).map((product) => (
                  <button
                    key={product.barcode}
                    className="pos-scan-result"
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={product.stock < 1}
                  >
                    <span>
                      <strong>{product.product}</strong>
                      <small>
                        {product.detail} · {product.barcode}
                      </small>
                    </span>
                    <span>
                      <b>{product.price}</b>
                      <small>{product.stock > 0 ? `${product.stock} left` : 'Out of stock'}</small>
                    </span>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="pos-scan-empty">No products match this search.</p>
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
                className={`pos-ticket-line${selectedLine === product.barcode ? ' is-selected' : ''}`}
                key={product.barcode}
                onClick={() => setSelectedLine(product.barcode)}
              >
                <span className="pos-ticket-line__no">{String(index + 1).padStart(2, '0')}</span>
                <div className="pos-ticket-line__name">
                  <strong>{product.product}</strong>
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
              <div className={`pos-ticket__empty${transactionActive ? ' is-active' : ''}`}>
                {transactionActive ? (
                  <>
                    <strong>Scan the first item.</strong>
                    <span>
                      Use the barcode scanner, or type part of a product name in the box above.
                    </span>
                  </>
                ) : (
                  <>
                    <strong>No sale is open.</strong>
                    <span>Open a ticket when the customer is at the counter.</span>
                    <button className="pos-ticket__start" type="button" onClick={startTransaction}>
                      Start transaction <CashierIcon name="arrow" />
                    </button>
                  </>
                )}
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
                <input
                  aria-label="Discount percent"
                  type="text"
                  inputMode="decimal"
                  value={discountInput}
                  placeholder="0"
                  maxLength={6}
                  onChange={(event) => setDiscountInput(sanitizeDiscountInput(event.target.value))}
                  onBlur={() => setDiscountInput(String(discountPercent))}
                />
                <span>%</span>
              </label>
            </div>
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
              disabled={!cart.length}
              onClick={() => setPaymentOpen(true)}
            >
              <span>Continue to payment</span>
              <CashierIcon name="arrow" />
            </button>
            <p className="pos-ticket__note">Records the sale in this browser and updates stock.</p>
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
                  : 'Start a transaction to unlock these controls.'}
              </p>
            </div>
          </div>
          <div className="pos-control-grid">
            <button
              className="pos-control-button"
              type="button"
              disabled={!transactionActive || !cart.length}
              onClick={clearSale}
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
              onClick={removeSelectedItem}
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
              onClick={() => stepSelectedQuantity(-1)}
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
              onClick={() => stepSelectedQuantity(1)}
            >
              <span className="pos-control-button__icon">
                <CashierIcon name="plus" />
              </span>
              <span className="pos-control-button__text">
                <strong>Quantity +</strong>
                <small>One more</small>
              </span>
            </button>
            <button className="pos-control-button" type="button" onClick={openVoidDialog}>
              <span className="pos-control-button__icon">
                <CashierIcon name="receipt" />
              </span>
              <span className="pos-control-button__text">
                <strong>Void sale</strong>
                <small>Correct a receipt</small>
              </span>
            </button>
            <button
              className="pos-control-button pos-control-button--no-charge"
              type="button"
              disabled={!transactionActive || !cart.length}
              onClick={openNoChargeDialog}
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
                Pick the receipt to cancel. Its items go back on the shelf and it stops counting in
                the shift totals. The sale on the counter is not touched.
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
                        <span>Receipt</span>
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
                        {!sale.lines?.length && (
                          <li>No item details were saved for this receipt.</li>
                        )}
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
                  disabled={!voidTarget || !voidReason.trim()}
                >
                  Void {voidTarget || 'sale'}
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
                leave stock and a slip is still recorded. A reason is required.
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
                disabled={!noChargeReason.trim()}
              >
                Record no-charge slip
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
            className={`pos-payment-modal${completedSale ? '' : ' pos-payment-modal--collect'}`}
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
                          <span>Discount ({discountPercent}%)</span>
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
                          <div>
                            <span>Send exactly</span>
                            <strong>{formatMoney(totalDue)}</strong>
                            <span>
                              {gcashDetails.number ? (
                                <>
                                  to GCash <b>{gcashDetails.number}</b>
                                </>
                              ) : (
                                'GCash number not set. Add it in Owner → Pharmacy settings.'
                              )}
                            </span>
                          </div>
                          {gcashDetails.qrUrl && (
                            <img src={gcashDetails.qrUrl} alt="Pharmacy GCash QR code" />
                          )}
                        </div>
                        <label className="pos-pay__field">
                          <span>GCash reference no.</span>
                          <input
                            value={gcashReference}
                            onChange={(event) => setGcashReference(event.target.value)}
                            placeholder="13-digit number on the customer's receipt"
                            inputMode="numeric"
                            autoComplete="off"
                            required
                          />
                        </label>
                        <button
                          type="button"
                          className={`pos-pay__verify${gcashPaid ? ' is-on' : ''}`}
                          aria-pressed={gcashPaid}
                          onClick={() => setGcashPaid((value) => !value)}
                        >
                          <span aria-hidden="true" />
                          {gcashPaid
                            ? 'Received: I saw it in the pharmacy GCash app'
                            : 'Not checked yet: tap after you see it in the GCash app'}
                        </button>
                        {!gcashPaid && (
                          <p className="pos-pay__hint">
                            You can still save it. It is marked Pending GCash until someone checks.
                          </p>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'Credit' && (
                      <div className="pos-pay__panel">
                        <label className="pos-pay__field">
                          <span>Customer name</span>
                          <input
                            name="credit-customer"
                            value={creditCustomer}
                            onChange={(event) => setCreditCustomer(event.target.value)}
                            autoComplete="off"
                            placeholder="Full name, so the utang is easy to find"
                            required
                            autoFocus
                          />
                        </label>
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
                      disabled={Boolean(paymentBlocker)}
                    >
                      {paymentMethod === 'Cash'
                        ? `Complete cash sale${change > 0 && !paymentBlocker ? ` · change ${formatMoney(change)}` : ''}`
                        : paymentMethod === 'GCash'
                          ? gcashPaid
                            ? 'Complete GCash sale'
                            : 'Save as pending GCash'
                          : 'Save as utang'}
                    </button>
                    <p className="pos-pay__status" aria-live="polite">
                      {paymentBlocker ||
                        'Saving records this sale in this browser and updates stock.'}
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

function SaleComplete({ sale, onDone }: { sale: CompletedSale; onDone: () => void }) {
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowReceipt(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`pos-sale-complete${showReceipt ? ' is-showing-receipt' : ''}`}>
      <div className="pos-sale-complete__success" aria-live="polite">
        <span className="pos-success-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.6 9.6 17 19 7.4"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2>Transaction complete</h2>
        <p className="pos-sale-complete__note">
          {sale.payment} · {formatMoney(sale.total)}
        </p>
      </div>
      <div className="pos-receipt-preview__toolbar">
        <button
          className="pos-receipt-preview__action pos-receipt-preview__action--print"
          type="button"
          onClick={() => window.print()}
        >
          Print receipt
        </button>
        <button
          className="pos-receipt-preview__action pos-receipt-preview__action--close"
          type="button"
          onClick={onDone}
        >
          Close
        </button>
      </div>
      <div className="pos-receipt-preview">
        <div className="pos-receipt-preview__head">
          <strong>Dagohoy Pharmacy</strong>
          <span>Sales receipt</span>
        </div>
        <div className="pos-receipt-preview__meta">
          <div>
            <span>Receipt no.</span>
            <strong>{sale.receipt}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatReceiptDate(sale.date)}</strong>
          </div>
          <div>
            <span>Cashier</span>
            <strong>{sale.cashier}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>{sale.payment}</strong>
          </div>
        </div>
        <ul className="pos-receipt-preview__lines">
          {sale.lines.map((line) => (
            <li key={`${line.product.barcode}-${line.product.product}`}>
              <div>
                <strong>{line.product.product}</strong>
                <small>
                  {line.quantity} × {formatMoney(toAmount(line.product.price))}
                </small>
              </div>
              <span>{formatMoney(toAmount(line.product.price) * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="pos-receipt-preview__totals">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(sale.subtotal)}</strong>
          </div>
          {sale.discount > 0 && (
            <div>
              <span>Discount</span>
              <strong>−{formatMoney(sale.discount)}</strong>
            </div>
          )}
          <div className="is-total">
            <span>Total</span>
            <strong>{formatMoney(sale.total)}</strong>
          </div>
          <div>
            <span>Payment method</span>
            <strong>{sale.payment}</strong>
          </div>
          <div>
            <span>Amount paid</span>
            <strong>{formatMoney(sale.amountPaid)}</strong>
          </div>
          {sale.change > 0 && (
            <div>
              <span>Change</span>
              <strong>{formatMoney(sale.change)}</strong>
            </div>
          )}
          {sale.payment === 'Credit' && (sale.creditBalance ?? 0) > 0 && (
            <div>
              <span>Remaining balance</span>
              <strong>{formatMoney(sale.creditBalance ?? 0)}</strong>
            </div>
          )}
          {sale.customer && (
            <div>
              <span>Customer</span>
              <strong>{sale.customer}</strong>
            </div>
          )}
          {sale.reference && (
            <div>
              <span>GCash ref.</span>
              <strong>{sale.reference}</strong>
            </div>
          )}
          {sale.paymentStatus && (
            <div>
              <span>GCash status</span>
              <strong>{sale.paymentStatus}</strong>
            </div>
          )}
          {sale.noChargeReason && (
            <div>
              <span>Reason</span>
              <strong>{sale.noChargeReason}</strong>
            </div>
          )}
        </div>
        <p className="pos-receipt-preview__thanks">
          {sale.payment === 'No charge'
            ? 'Released without charge. Keep this slip for your records.'
            : 'Thank you. Keep this receipt for your records.'}
        </p>
      </div>
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
