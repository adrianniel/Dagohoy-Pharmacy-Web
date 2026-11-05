import { FormEvent, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import { loadMovements, saveMovements } from '../../data/operationsStore';
import CartIcon from '../../components/originkit/ui/CartIcon';

type CatalogProduct = ReturnType<typeof getInventory>[number];
type PosProduct = Omit<CatalogProduct, 'stock' | 'status'> & {
  stock?: number;
  localProductId?: number;
  localProductUnitId?: number | null;
};
type CartLine = { product: PosProduct; quantity: number };
type PaymentMethod = 'Cash' | 'GCash' | 'Credit';
const toAmount = (price: string) => Number(price.replace(/[₱,]/g, ''));
const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const SALES_KEY = 'dagohoy_demo_sales';
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

  function completeSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const receipt = `DP-DEMO-${String(Date.now()).slice(-6)}`;
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
      payment: paymentMethod,
      customer: paymentMethod === 'Credit' ? creditCustomer.trim() : undefined,
      amountPaid:
        paymentMethod === 'Cash' || paymentMethod === 'Credit'
          ? Number(tendered || 0)
          : gcashPaid
            ? totalDue
            : 0,
      change: paymentMethod === 'Cash' ? change : 0,
      creditBalance: paymentMethod === 'Credit' ? creditBalance : 0,
      gcashReference: paymentMethod === 'GCash' ? gcashReference.trim() : undefined,
      paymentStatus: paymentMethod === 'GCash' ? (gcashPaid ? 'Paid' : 'Unpaid') : undefined,
      status:
        paymentMethod === 'Credit' && creditBalance > 0
          ? 'Credit'
          : paymentMethod === 'GCash' && !gcashPaid
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
        staff: 'Demo cashier',
        reason: 'Completed demo POS sale',
      })),
      ...previousMovements,
    ]);
    setCart([]);
    setTransactionActive(false);
    setTendered('');
    setCreditCustomer('');
    setGcashReference('');
    setGcashPaid(false);
    setPaymentOpen(false);
    showToast(
      `Demo sale ${receipt} completed. No live sale was sent to the pharmacy server.`,
      'info',
    );
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
            <button
              className="cashier-text-button pos-clear-sale"
              type="button"
              disabled={!transactionActive || !cart.length}
              onClick={() => {
                setCart([]);
                showToast('All scanned items cleared.', 'info');
                window.requestAnimationFrame(() =>
                  document.querySelector<HTMLInputElement>('input[name="product-search"]')?.focus(),
                );
              }}
            >
              Clear all
            </button>
          </div>
          <div className="pos-order-lines">
            {cart.map(({ product, quantity }) => (
              <div className="pos-order-line" key={product.barcode}>
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
                    onClick={() => changeQuantity(product.barcode, -1)}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.product}`}
                    onClick={() => changeQuantity(product.barcode, 1)}
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
          <p className="pos-demo-disclaimer">
            Demo checkout only · does not record a live pharmacy sale.
          </p>
        </section>
        <aside className="cashier-panel pos-workbench" aria-labelledby="pos-workbench-heading">
          <div className="cashier-panel__heading">
            <div>
              <h3 id="pos-workbench-heading">Find a product or check the price</h3>
              <p>
                Search by product, generic name, brand, or barcode. Add it to the current sale only
                if you want it.
              </p>
            </div>
          </div>
          <div className="pos-input-panel pos-find-panel">
            <label className="pos-barcode-field pos-catalog-search">
              <span>Search or scan</span>
              <div>
                <CashierIcon name="search" />
                <input
                  name="product-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  autoFocus
                  placeholder="Type or scan a barcode…"
                />
              </div>
            </label>
          </div>
          {query.trim() ? (
            <div className="pos-search-results" aria-live="polite">
              <div className="pos-search-results__heading">
                <strong>
                  {filteredProducts.length} matching product
                  {filteredProducts.length === 1 ? '' : 's'}
                </strong>
                <button type="button" onClick={() => setQuery('')}>
                  Clear search
                </button>
              </div>
              {filteredProducts.map((product) => (
                <article className="pos-search-result" key={product.barcode}>
                  <div className="pos-search-result__summary">
                    <span>
                      <strong>{product.product}</strong>
                      <small>
                        {product.detail} · {product.unit} · {product.barcode}
                      </small>
                    </span>
                    <span>
                      <b>{product.price}</b>
                      <small>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </small>
                    </span>
                  </div>
                  <div className="pos-search-result__actions">
                    <button
                      className="pos-search-result__info"
                      type="button"
                      aria-expanded={expandedProduct?.barcode === product.barcode}
                      onClick={() =>
                        setExpandedProduct((current) =>
                          current?.barcode === product.barcode ? null : product,
                        )
                      }
                    >
                      Info
                    </button>
                    <button
                      className="pos-search-result__add"
                      type="button"
                      onClick={() => addProduct(product)}
                      disabled={product.stock < 1}
                      title="Add to the current sale list"
                    >
                      {product.stock > 0 ? 'Add to sale' : 'Out of stock'}
                    </button>
                  </div>
                  {expandedProduct?.barcode === product.barcode && (
                    <p className="pos-search-result__details">
                      Available stock: {product.stock} {product.unit.toLowerCase()}
                      {product.stock === 1 ? '' : 's'} · Barcode: {product.barcode}
                    </p>
                  )}
                </article>
              ))}
              {filteredProducts.length === 0 && (
                <p className="pos-empty-state">No products match this search.</p>
              )}
            </div>
          ) : (
            <div className="pos-workbench-empty">
              <CashierIcon name="search" />
              <strong>Product and price lookup</strong>
              <span>
                Type a product name, generic name, brand, or scan a barcode to check price and
                stock.
              </span>
            </div>
          )}
        </aside>
      </div>
      {paymentOpen && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaymentOpen(false);
          }}
        >
          <form className="pos-payment-modal" onSubmit={completeSale}>
            <button
              className="pos-modal-close"
              type="button"
              onClick={() => setPaymentOpen(false)}
              aria-label="Close payment"
            >
              ×
            </button>
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
                    min={totalDue}
                    step="0.01"
                    type="number"
                    value={tendered}
                    onChange={(event) => setTendered(event.target.value)}
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
                    min="0"
                    max={totalDue}
                    step="0.01"
                    type="number"
                    value={tendered}
                    onChange={(event) => setTendered(event.target.value)}
                    inputMode="decimal"
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
                      <span>GCash number not configured. Add it in Owner → Pharmacy settings.</span>
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
              className="pos-checkout-button"
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
              Complete demo sale
            </button>
            <p className="pos-demo-disclaimer">This saves a demo record in this browser only.</p>
          </form>
        </div>
      )}
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
