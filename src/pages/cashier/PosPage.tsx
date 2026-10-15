import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { mockCartItems } from '../../data/cashierMockData';

export function CashierPosPage() {
  return (
    <div className="cashier-page cashier-pos-page">
      <CashierPageHeader
        eyebrow="Sales workspace"
        title="Point of Sale"
        description="Fast checkout designed for barcode scanning and keyboard use."
      />

      <section className="pos-input-panel">
        <label className="pos-barcode-field">
          <span>Barcode</span>
          <div>
            <CashierIcon name="pos" />
            <input autoFocus type="text" placeholder="Scan or enter barcode" />
            <kbd>Enter</kbd>
          </div>
        </label>
        <span className="pos-input-divider">or</span>
        <label className="cashier-search-field pos-search-field">
          <CashierIcon name="search" />
          <input type="search" placeholder="Search product by name, generic, or brand" />
        </label>
      </section>

      <div className="pos-workspace-grid">
        <section className="cashier-panel pos-cart-panel">
          <div className="cashier-panel__heading">
            <div>
              <h3>Current sale</h3>
              <p>2 products · 3 total items</p>
            </div>
            <button className="cashier-text-button" type="button">
              Clear cart
            </button>
          </div>
          <div className="cashier-table-wrap">
            <table className="cashier-table pos-cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {mockCartItems.map((item) => (
                  <tr key={item.product}>
                    <td>
                      <strong>{item.product}</strong>
                      <small>{item.detail}</small>
                    </td>
                    <td>
                      <div className="pos-quantity">
                        <button type="button">−</button>
                        <span>{item.quantity}</span>
                        <button type="button">+</button>
                      </div>
                    </td>
                    <td>{item.unit}</td>
                    <td>{item.price}</td>
                    <td>
                      <strong>{item.subtotal}</strong>
                    </td>
                    <td>
                      <button
                        className="pos-remove"
                        type="button"
                        aria-label={`Remove ${item.product}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pos-cart-placeholder">
            <CashierIcon name="products" />
            <span>Scan the next product to add it to this sale.</span>
          </div>
        </section>

        <aside className="cashier-panel pos-summary">
          <div>
            <p className="pos-summary__label">Order summary</p>
            <span className="pos-summary__reference">New sale</span>
          </div>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>₱19.75</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>₱0.00</dd>
            </div>
            <div className="pos-summary__total">
              <dt>Total</dt>
              <dd>₱19.75</dd>
            </div>
          </dl>
          <button className="pos-checkout-button" type="button">
            Proceed to Payment <CashierIcon name="arrow" />
          </button>
          <p className="pos-summary__hint">
            Payment workflow will be connected in a future milestone.
          </p>
        </aside>
      </div>
    </div>
  );
}
