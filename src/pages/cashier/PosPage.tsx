import { FormEvent, useMemo, useRef, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { getInventory } from '../../data/inventoryStore';

type Product = ReturnType<typeof getInventory>[number];
type CartLine = { product: Product; quantity: number };
const toAmount = (price: string) => Number(price.replace(/[₱,]/g, ''));
const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const SALES_KEY = 'dagohoy_demo_sales';

export function CashierPosPage() {
  const [products] = useState(getInventory);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [barcode, setBarcode] = useState('');
  const [query, setQuery] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [tendered, setTendered] = useState('');
  const [notice, setNotice] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const subtotal = cart.reduce(
    (total, line) => total + toAmount(line.product.price) * line.quantity,
    0,
  );
  const totalItems = cart.reduce((total, line) => total + line.quantity, 0);
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.product} ${product.detail} ${product.barcode}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [products, query],
  );
  const change = Math.max(0, Number(tendered) - subtotal);

  function addProduct(product: Product) {
    if (product.stock < 1) {
      setNotice(`${product.product} is out of stock.`);
      return;
    }
    setNotice('');
    setCart((current) => {
      const existing = current.find((line) => line.product.barcode === product.barcode);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setNotice(`Only ${product.stock} ${product.unit.toLowerCase()}s are available.`);
          return current;
        }
        return current.map((line) =>
          line.product.barcode === product.barcode
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
    setBarcode('');
    setQuery('');
    barcodeRef.current?.focus();
  }

  function handleBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((item) => item.barcode === barcode.trim());
    if (product) addProduct(product);
    else setNotice('No matching product found. Check the barcode or use product search.');
  }

  function changeQuantity(barcodeValue: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.product.barcode !== barcodeValue) return [line];
        const quantity = line.quantity + delta;
        if (quantity < 1) return [];
        if (quantity > line.product.stock) {
          setNotice(
            `Only ${line.product.stock} ${line.product.unit.toLowerCase()}s are available.`,
          );
          return [line];
        }
        return [{ ...line, quantity }];
      }),
    );
  }

  function completeSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentMethod === 'Cash' && Number(tendered) < subtotal) return;
    const sales = JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Array<
      Record<string, unknown>
    >;
    const receipt = `DP-DEMO-${String(Date.now()).slice(-6)}`;
    sales.unshift({
      receipt,
      date: new Date().toISOString(),
      items: totalItems,
      total: subtotal,
      payment: paymentMethod,
      status: 'Completed',
    });
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
    setCart([]);
    setTendered('');
    setPaymentOpen(false);
    setNotice(`Demo sale ${receipt} completed. No live sale was sent to the pharmacy server.`);
    window.setTimeout(() => setNotice(''), 6000);
  }

  return (
    <div className="cashier-page cashier-pos-page">
      <CashierPageHeader
        eyebrow="Checkout workspace"
        title="Point of Sale"
        description="Scan a barcode or search the sample catalog to build a sale."
      />
      <div className="pos-layout">
        <div className="pos-catalog-column">
          <form className="pos-input-panel pos-scan-panel" onSubmit={handleBarcode}>
            <label className="pos-barcode-field">
              <span>Scan barcode</span>
              <div>
                <CashierIcon name="pos" />
                <input
                  ref={barcodeRef}
                  autoFocus
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Scan or type a barcode"
                />
                <button type="submit" aria-label="Add barcode">
                  ↵
                </button>
              </div>
            </label>
            <label className="pos-barcode-field pos-catalog-search">
              <span>Find a product</span>
              <div>
                <CashierIcon name="search" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, generic, brand"
                />
              </div>
            </label>
          </form>
          {notice && (
            <p className="pos-notice" role="status">
              {notice}
            </p>
          )}
          <section className="cashier-panel pos-catalog-panel">
            <div className="cashier-panel__heading">
              <div>
                <h3>Available products</h3>
                <p>Sample catalog · stock availability is illustrative</p>
              </div>
              <span>{filteredProducts.length} items</span>
            </div>
            <div className="pos-product-grid">
              {filteredProducts.map((product) => (
                <button
                  className="pos-product-card"
                  key={product.barcode}
                  type="button"
                  onClick={() => addProduct(product)}
                  disabled={product.stock < 1}
                >
                  <span className="pos-product-card__category">{product.unit}</span>
                  <strong>{product.product}</strong>
                  <small>{product.detail}</small>
                  <span className="pos-product-card__bottom">
                    <b>{product.price}</b>
                    <small>
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <p className="pos-empty-state">No products match your search.</p>
            )}
          </section>
        </div>
        <aside className="cashier-panel pos-order-panel">
          <div className="cashier-panel__heading">
            <div>
              <h3>Current sale</h3>
              <p>
                {totalItems} item{totalItems === 1 ? '' : 's'} · {cart.length} product
                {cart.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              className="cashier-text-button"
              type="button"
              disabled={!cart.length}
              onClick={() => {
                setCart([]);
                setNotice('Sale cleared.');
              }}
            >
              Clear
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
              <div className="pos-order-empty">
                <CashierIcon name="pos" />
                <strong>Your sale is empty</strong>
                <span>Scan a barcode or select a product to get started.</span>
              </div>
            )}
          </div>
          <div className="pos-order-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <button
                type="button"
                className="cashier-text-button"
                onClick={() =>
                  setNotice(
                    'Discount controls will be connected after discount rules are confirmed.',
                  )
                }
              >
                Add discount
              </button>
            </div>
            <div className="pos-order-grand-total">
              <span>Total due</span>
              <strong>{formatMoney(subtotal)}</strong>
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
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <label>
              Payment method
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option>Cash</option>
                <option>GCash</option>
                <option>Card</option>
              </select>
            </label>
            {paymentMethod === 'Cash' && (
              <>
                <label>
                  Amount received
                  <input
                    autoFocus
                    min={subtotal}
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
            <button
              className="pos-checkout-button"
              type="submit"
              disabled={paymentMethod === 'Cash' && Number(tendered) < subtotal}
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
