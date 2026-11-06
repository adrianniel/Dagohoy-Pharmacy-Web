import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../cashier/CashierIcon';
import type { InventoryProduct } from '../../data/inventoryStore';

type StockControlCenterProps = {
  products: InventoryProduct[];
  threshold: number;
  restockCount: number;
  /** Scrolls down to the product search field and puts the cursor in it. */
  onFindProduct: () => void;
  /** Downloads the restock order basis for the supplier. */
  onOrderRestock: () => void;
};

export function StockControlCenter({
  products,
  threshold,
  restockCount,
  onFindProduct,
  onOrderRestock,
}: StockControlCenterProps) {
  const [healthOpen, setHealthOpen] = useState(false);

  const healthy = products.filter((product) => product.stock >= threshold).length;
  const low = products.filter((product) => product.stock > 0 && product.stock < threshold).length;
  const out = products.filter((product) => product.stock <= 0).length;
  const total = products.length || 1;
  const share = (count: number) => `${Math.round((count / total) * 100)}%`;

  return (
    <section className="stock-index" aria-label="Stock control center">
      <div className="stock-index__head">
        <div>
          <h3>Stock control center</h3>
          <p>The everyday stock shortcuts, in one place.</p>
        </div>
        {restockCount > 0 && (
          <span className="stock-index__count">
            {restockCount} to restock
          </span>
        )}
      </div>

      <div className="stock-index__grid">
        <Link className="stock-index__tile" to="/admin/purchases">
          <span className="stock-index__icon">
            <CashierIcon name="purchases" />
          </span>
          <strong>Receive stock</strong>
          <small>Log a delivery and create a batch</small>
        </Link>

        <button
          className="stock-index__tile"
          type="button"
          onClick={() => setHealthOpen((open) => !open)}
          aria-expanded={healthOpen}
        >
          <span className="stock-index__icon">
            <CashierIcon name="reports" />
          </span>
          <strong>Stock health</strong>
          <small>
            {low + out > 0 ? `${low + out} need attention` : 'All above the reorder point'}
          </small>
        </button>

        <Link className="stock-index__tile" to="/admin/batches">
          <span className="stock-index__icon">
            <CashierIcon name="batches" />
          </span>
          <strong>Expiry check</strong>
          <small>See what expires in the next 30 days</small>
        </Link>

        <Link className="stock-index__tile" to="/admin/batches">
          <span className="stock-index__icon">
            <CashierIcon name="inventory" />
          </span>
          <strong>Stock batches</strong>
          <small>Lot numbers and quantities per batch</small>
        </Link>

        <button
          className="stock-index__tile"
          type="button"
          onClick={onOrderRestock}
          disabled={restockCount === 0}
        >
          <span className="stock-index__icon">
            <CashierIcon name="suppliers" />
          </span>
          <strong>Order for restock</strong>
          <small>{restockCount > 0 ? 'Download the restock order' : 'Nothing to reorder yet'}</small>
        </button>

        <button className="stock-index__tile" type="button" onClick={onFindProduct}>
          <span className="stock-index__icon">
            <CashierIcon name="products" />
          </span>
          <strong>Find a product</strong>
          <small>Jump straight to the search field</small>
        </button>
      </div>

      {healthOpen && (
        <div className="stock-index__health" role="region" aria-label="Stock health summary">
          <div className="stock-index__stat stock-index__stat--ok">
            <span>Healthy</span>
            <strong>{healthy}</strong>
            <div className="stock-index__bar">
              <i style={{ width: share(healthy) }} />
            </div>
          </div>
          <div className="stock-index__stat stock-index__stat--low">
            <span>Low stock</span>
            <strong>{low}</strong>
            <div className="stock-index__bar">
              <i style={{ width: share(low) }} />
            </div>
          </div>
          <div className="stock-index__stat stock-index__stat--out">
            <span>Out of stock</span>
            <strong>{out}</strong>
            <div className="stock-index__bar">
              <i style={{ width: share(out) }} />
            </div>
          </div>
          <p className="stock-index__note">
            The reorder point is {threshold} units. Change it in the pharmacy threshold setting.
          </p>
        </div>
      )}
    </section>
  );
}
