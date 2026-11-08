import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import { loadMovements, saveMovements } from '../../data/operationsStore';
import CartIcon from '../../components/originkit/ui/CartIcon';
import { getWorkspaceProfile } from '../../data/accountStore';
import { REGISTER_SESSION_KEY } from '../../data/registerSession';

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
  lines?: Array<{ product: string; barcode: string; quantity: number; unitPrice: number }>;
};
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

  function closePayment() {
    setPaymentOpen(false);
    setCompletedSale(null);
  }

  function selectPaymentMethod(nextMethod: PaymentMethod) {
    setPaymentMethod(nextMethod);
    setTendered(nextMethod === 'Credit' ? '0' : '');
    setGcashReference('');
    setGcashPaid(false);
  }

  function startTransaction() {
    setTransactionActive(true);
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
    const latest = readSales().filter((sale) => sale.status !== 'Voided').slice(0, 5);
    if (!latest.length) {
      showToast('No recent transactions to void yet.', 'info');
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
          sale.receipt === voidTarget ? { ...sale, status: 'Voided' } : sale,
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
        staff: 'Cashier',
        reason: `Voided sale: ${reason}`,
      })),
      ...previousMovements,
    ]);
    setControlModal(null);
    setVoidReason('');
    setCart([]);
    setSelectedLine(null);
    setDiscountInput('0');
    setTransactionActive(true);
    showToast(`Transaction ${voidTarget} voided. Start the corrected sale.`, 'success');
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
        <section className="cashier-panel pos-order-panel" aria-labelledby="pos-sale-heading">
          <div className="cashier-panel__heading">
            <div className="pos-order-heading">
              <span className="pos-order-heading__icon" aria-hidden="true">
                <CartIcon size={23} color="#fffdf1" strokeWidth={1.8} />
              </span>
              <div>
                <h3 id="pos-sale-heading">Current sale</h3>
                <p>
                  {totalItems} item{totalItems === 1 ? '' : 's'} · {cart.length} product
                  {cart.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>
          <div className="pos-scan-dock">
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
                placeholder="Scan barcode or search a product…"
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
          <div className="pos-order-lines">
            {cart.map(({ product, quantity }) => (
              <div
                className={`pos-order-line${
                  selectedLine === product.barcode ? ' is-selected' : ''
                }`}
                key={product.barcode}
                onClick={() => setSelectedLine(product.barcode)}
              >
                <div className="pos-order-line__name">
                  <strong>{product.product}</strong>
                  <small>
                    {formatMoney(toAmount(product.price))} / {product.unit}
                  </small>
                </div>
                <div className="pos-quantity">
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
                <strong className="pos-line-total">
                  {formatMoney(toAmount(product.price) * quantity)}
                </strong>
              </div>
            ))}
            {!cart.length && (
              <div className={`pos-order-empty${transactionActive ? ' is-active' : ''}`}>
                {transactionActive ? (
                  <>
                    <strong>Ready for the first item</strong>
                    <span>
                      Scan a barcode or search for a product in the helper panel to add it here.
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      className="pos-start-transaction"
                      type="button"
                      onClick={startTransaction}
                    >
                      Start transaction <CashierIcon name="arrow" />
                    </button>
                    <span>
                      Begin a transaction to unlock
                      <br />
                      scanning and build the current sale.
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="pos-order-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div>
              <span>Discount (%)</span>
              <label className="pos-discount-input">
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
              <div>
                <span>Discount applied</span>
                <strong>−{formatMoney(discount)}</strong>
              </div>
            )}
            <div className="pos-order-grand-total">
              <span>Total due</span>
              <strong>{formatMoney(totalDue)}</strong>
            </div>
          </div>
          <button
            className="pos-checkout-button"
            type="button"
            disabled={!cart.length}
            onClick={() => setPaymentOpen(true)}
          >
            Continue to payment <CashierIcon name="arrow" />
          </button>
          <p className="pos-demo-disclaimer">Records the sale in this browser and updates stock.</p>
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
            <button
              className="pos-control-button"
              type="button"
              disabled={!transactionActive}
              onClick={openVoidDialog}
            >
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
            <form className="pos-payment-modal pos-control-modal" onSubmit={submitVoid}>
              <button
                className="pos-modal-close"
                type="button"
                onClick={() => setControlModal(null)}
                aria-label="Close void sale"
              >
                ×
              </button>
              <p className="eyebrow">Correction</p>
              <h2>Void a transaction</h2>
              <p className="pos-control-modal__note">
                Pick one of the last 5 receipts. The items go back to stock and a new sale starts
                right after so you can correct it.
              </p>
              <fieldset className="pos-void-list">
                <legend>Recent transactions</legend>
                {recentSales.map((sale) => (
                  <label
                    key={sale.receipt}
                    className={`pos-void-option${voidTarget === sale.receipt ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="void-target"
                      checked={voidTarget === sale.receipt}
                      onChange={() => setVoidTarget(sale.receipt)}
                    />
                    <span>
                      <strong>{sale.receipt}</strong>
                      <small>
                        {formatReceiptDate(sale.date)} · {sale.items ?? 0} item
                        {Number(sale.items ?? 0) === 1 ? '' : 's'}
                      </small>
                    </span>
                    <b>{formatMoney(Number(sale.total ?? 0))}</b>
                  </label>
                ))}
              </fieldset>
              <label>
                Reason for void
                <textarea
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  placeholder="Example: wrong item charged, customer cancelled"
                  rows={3}
                  required
                />
              </label>
              <button
                className="pos-checkout-button pos-control-modal__submit"
                type="submit"
                disabled={!voidTarget || !voidReason.trim()}
              >
                Void transaction
              </button>
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
          <form className="pos-payment-modal" onSubmit={completeSale}>
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
                <p className="eyebrow">Payment</p>
                <h2>Collect payment</h2>
                <div className="pos-payment-total">
                  <span>Total due</span>
                  <strong>{formatMoney(totalDue)}</strong>
                </div>
                <fieldset className="payment-method-options">
                  <legend className="payment-method-options__legend">Payment method</legend>
                  <div className="payment-method-options__grid">
                    {PAYMENT_METHOD_OPTIONS.map((method) => (
                      <button
                        key={method.id}
                        className={`payment-method-option${
                          paymentMethod === method.id ? ' is-selected' : ''
                        }`}
                        type="button"
                        aria-pressed={paymentMethod === method.id}
                        onClick={() => selectPaymentMethod(method.id)}
                      >
                        <span className="payment-method-option__icon" aria-hidden="true">
                          <CashierIcon name={method.icon} />
                        </span>
                        <span className="payment-method-option__copy">
                          <strong>{method.name}</strong>
                          <small>{method.detail}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {paymentMethod === 'Cash' && (
                  <>
                    <label>
                      Amount received
                      <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="pos-amount-input"
                        value={tendered}
                        onChange={(event) => setTendered(sanitizeMoneyInput(event.target.value))}
                        placeholder="0.00"
                        required
                      />
                    </label>
                    <div className="pos-payment-change">
                      <span>Change</span>
                      <strong>{formatMoney(change)}</strong>
                    </div>
                  </>
                )}
                {paymentMethod === 'Credit' && (
                  <>
                    <label>
                      Customer name
                      <input
                        name="credit-customer"
                        value={creditCustomer}
                        onChange={(event) => setCreditCustomer(event.target.value)}
                        autoComplete="name"
                        placeholder="Customer name…"
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Amount paid
                      <input
                        name="credit-amount-paid"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="pos-amount-input"
                        value={tendered}
                        onChange={(event) => setTendered(sanitizeMoneyInput(event.target.value))}
                        placeholder="0.00"
                        required
                      />
                    </label>
                    <div className="pos-payment-change pos-payment-change--credit">
                      <span>Remaining balance</span>
                      <strong>{formatMoney(creditBalance)}</strong>
                    </div>
                  </>
                )}
                {paymentMethod === 'GCash' && (
                  <>
                    <div className="gcash-payment-details">
                      <div>
                        <strong>Pay via GCash</strong>
                        <span>
                          Ask the customer to send the exact amount. No payment is processed in this
                          system.
                        </span>
                        {gcashDetails.number ? (
                          <span>
                            GCash number: <b>{gcashDetails.number}</b>
                          </span>
                        ) : (
                          <span>
                            GCash number not configured. Add it in Owner → Pharmacy settings.
                          </span>
                        )}
                      </div>
                      {gcashDetails.qrUrl && (
                        <img src={gcashDetails.qrUrl} alt="Pharmacy GCash QR code" />
                      )}
                    </div>
                    <label>
                      GCash reference number
                      <input
                        value={gcashReference}
                        onChange={(event) => setGcashReference(event.target.value)}
                        placeholder="Enter transaction reference number"
                        required
                      />
                    </label>
                    <label className="gcash-paid-check">
                      <input
                        type="checkbox"
                        checked={gcashPaid}
                        onChange={(event) => setGcashPaid(event.target.checked)}
                      />
                      I manually verified this GCash payment as received
                    </label>
                    <div className={`gcash-manual-status${gcashPaid ? ' is-paid' : ''}`}>
                      Manual payment status:{' '}
                      <strong>{gcashPaid ? 'Paid' : 'Unpaid / pending verification'}</strong>
                    </div>
                  </>
                )}
                <button
                  className="pos-checkout-button pos-complete-button"
                  type="submit"
                  disabled={
                    (paymentMethod === 'Cash' && Number(tendered) < totalDue) ||
                    (paymentMethod === 'Credit' &&
                      (!creditCustomer.trim() ||
                        Number(tendered) < 0 ||
                        Number(tendered) > totalDue)) ||
                    (paymentMethod === 'GCash' && !gcashReference.trim())
                  }
                >
                  Complete transaction
                </button>
                <p className="pos-demo-disclaimer">
                  Saving records this sale in this browser and updates stock.
                </p>
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
