import { FormEvent, useMemo, useState } from 'react';
import { BarcodeScannerInput } from '../../components/BarcodeScannerInput';
import { useToast } from '../../components/toast';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import { loadMovements, saveMovements } from '../../data/operationsStore';
import { lookupProductByBarcode } from '../../services/productsApi';

type CatalogProduct = ReturnType<typeof getInventory>[number];
type PosProduct = Omit<CatalogProduct, 'stock' | 'status'> & {
  stock?: number;
  localProductId?: number;
  localProductUnitId?: number | null;
};
type CartLine = { product: PosProduct; quantity: number };
type PaymentMethod = 'Cash' | 'GCash' | 'Card' | 'Credit';
const toAmount = (price: string) => Number(price.replace(/[₱,]/g, ''));
const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const SALES_KEY = 'dagohoy_demo_sales';

export function CashierPosPage() {
  const [products] = useState(getInventory);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [tendered, setTendered] = useState('');
  const [creditCustomer, setCreditCustomer] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<CatalogProduct | null>(null);
  const { showToast } = useToast();
  const subtotal = cart.reduce(
    (total, line) => total + toAmount(line.product.price) * line.quantity,
    0,
  );
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

  function addProduct(product: PosProduct) {
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
  }

  async function handleBarcodeScan(barcode: string) {
    const result = await lookupProductByBarcode(barcode);
    if (!result.found) {
      showToast(
        `Product not found for barcode ${barcode}. Encode the product before selling it.`,
        'error',
      );
      return;
    }

    if (result.product.sellingPrice === null) {
      showToast(`${result.product.name} has no current selling price configured.`, 'error');
      return;
    }

    const detail = [result.product.genericName, result.product.brand, result.product.strength]
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
      .join(' · ');
    addProduct({
      barcode: result.product.barcode,
      product: result.product.name,
      detail,
      unit: result.product.productUnit?.name ?? 'Unconfigured unit',
      price: formatMoney(result.product.sellingPrice),
      localProductId: result.product.id,
      localProductUnitId: result.product.productUnit?.id ?? null,
    });
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
        paymentMethod === 'Cash' || paymentMethod === 'Credit' ? Number(tendered || 0) : totalDue,
      change: paymentMethod === 'Cash' ? change : 0,
      creditBalance: paymentMethod === 'Credit' ? creditBalance : 0,
      status: paymentMethod === 'Credit' && creditBalance > 0 ? 'Credit' : 'Completed',
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
    setTendered('');
    setCreditCustomer('');
    setPaymentOpen(false);
    showToast(
      `Demo sale ${receipt} completed. No live sale was sent to the pharmacy server.`,
      'info',
    );
  }

  return (
    <div className="cashier-page cashier-pos-page">
      <CashierPageHeader
        eyebrow="Checkout workspace"
        title="Point of Sale"
        description="Scan a barcode or search for a product to build the current sale."
      />
      <div className="pos-layout">
        <section className="cashier-panel pos-workbench">
          <div className="cashier-panel__heading">
            <div>
              <h3>Scan or find a product</h3>
              <p>Use a barcode scanner or type a product name, generic name, or brand.</p>
            </div>
          </div>
          <div className="pos-input-panel pos-scan-panel">
            <BarcodeScannerInput onScan={handleBarcodeScan} autoFocus />
            <label className="pos-barcode-field pos-catalog-search">
              <span>Find a product</span>
              <div>
                <CashierIcon name="search" />
                <input
                  name="product-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  placeholder="Search name, generic, or brand…"
                />
              </div>
            </label>
          </div>
          {query.trim() ? (
            <div className="pos-search-results" aria-live="polite">
              <div className="pos-search-results__heading">
                <strong>{filteredProducts.length} matching products</strong>
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
              <strong>Ready for the next item</strong>
              <span>Scan a barcode or start typing to show matching products.</span>
            </div>
          )}
        </section>
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
                showToast('Sale cleared.', 'info');
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
              <span>Discount (%)</span>
              <label className="pos-discount-input">
                <input
                  aria-label="Discount percent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPercent}
                  onChange={(event) =>
                    setDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value))))
                  }
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
            <label>
              Payment method
              <select
                value={paymentMethod}
                onChange={(event) => {
                  const nextMethod = event.target.value as PaymentMethod;
                  setPaymentMethod(nextMethod);
                  setTendered(nextMethod === 'Credit' ? '0' : '');
                }}
              >
                <option>Cash</option>
                <option>GCash</option>
                <option>Card</option>
                <option>Credit</option>
              </select>
            </label>
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
            <button
              className="pos-checkout-button"
              type="submit"
              disabled={
                (paymentMethod === 'Cash' && Number(tendered) < totalDue) ||
                (paymentMethod === 'Credit' &&
                  (!creditCustomer.trim() || Number(tendered) < 0 || Number(tendered) > totalDue))
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
