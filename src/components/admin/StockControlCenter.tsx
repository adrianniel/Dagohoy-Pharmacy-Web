import { useMemo, useState } from 'react';
import { CashierIcon } from '../cashier/CashierIcon';
import type { InventoryProduct } from '../../data/inventoryStore';
import {
  InventoryBatch,
  loadBatches,
  loadMovements,
  loadPurchaseOrders,
} from '../../data/operationsStore';
import { initialBatches } from '../../pages/admin/OperationsPage';

type PanelKey = 'receive' | 'health' | 'expiry' | 'batches' | 'order' | 'find';

type StockControlCenterProps = {
  products: InventoryProduct[];
  threshold: number;
  restockCount: number;
  /** Downloads the restock order basis for the supplier. */
  onOrderRestock: () => void;
};

function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
}

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${date}T12:00:00`),
  );

export function StockControlCenter({
  products,
  threshold,
  restockCount,
  onOrderRestock,
}: StockControlCenterProps) {
  const [active, setActive] = useState<PanelKey | null>(null);
  const [findQuery, setFindQuery] = useState('');

  const healthy = products.filter((product) => product.stock >= threshold).length;
  const low = products.filter((product) => product.stock > 0 && product.stock < threshold).length;
  const out = products.filter((product) => product.stock <= 0).length;
  const total = products.length || 1;
  const share = (count: number) => `${Math.round((count / total) * 100)}%`;
  const restockProducts = products.filter((product) => product.stock < threshold);

  const data = useMemo(() => {
    if (!active) return null;
    const batches: InventoryBatch[] = loadBatches(initialBatches);
    const orders = loadPurchaseOrders();
    const movements = loadMovements();
    const openOrders = orders.filter((order) => order.status !== 'Received');
    const receivedToday = movements.filter(
      (movement) =>
        movement.kind === 'Received' &&
        new Date(movement.date).toDateString() === new Date().toDateString(),
    );
    const soonExpiring = batches.filter((batch) => {
      const days = daysUntil(batch.expiry);
      return days >= 0 && days <= 30;
    });
    const expired = batches.filter((batch) => daysUntil(batch.expiry) < 0);
    return { batches, orders, openOrders, receivedToday, soonExpiring, expired };
  }, [active]);

  const findResults = useMemo(() => {
    const needle = findQuery.trim().toLowerCase();
    const matches = products.filter((product) =>
      `${product.product} ${product.detail} ${product.barcode} ${product.category ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
    return matches.slice(0, 8);
  }, [findQuery, products]);

  const toggle = (key: PanelKey) => setActive((current) => (current === key ? null : key));

  const tiles: Array<{
    key: PanelKey;
    icon: Parameters<typeof CashierIcon>[0]['name'];
    title: string;
    hint: string;
    disabled?: boolean;
  }> = [
    {
      key: 'receive',
      icon: 'purchases',
      title: 'Receive stock',
      hint:
        data?.openOrders.length && active === 'receive'
          ? `${data.openOrders.length} open order(s)`
          : 'Deliveries waiting to be received',
    },
    {
      key: 'health',
      icon: 'reports',
      title: 'Stock health',
      hint: low + out > 0 ? `${low + out} need attention` : 'All above the reorder point',
    },
    {
      key: 'expiry',
      icon: 'batches',
      title: 'Expiry check',
      hint: active === 'expiry' ? `${data?.soonExpiring.length ?? 0} in 30 days` : 'Next 30 days',
    },
    {
      key: 'batches',
      icon: 'inventory',
      title: 'Stock batches',
      hint: active === 'batches' ? `${data?.batches.length ?? 0} lots tracked` : 'Lot numbers per batch',
    },
    {
      key: 'order',
      icon: 'suppliers',
      title: 'Order for restock',
      hint: restockCount > 0 ? `${restockCount} to reorder` : 'Nothing to reorder yet',
    },
    {
      key: 'find',
      icon: 'products',
      title: 'Find a product',
      hint: 'Search right here',
    },
  ];

  return (
    <section className="stock-index" aria-label="Stock control center">
      <div className="stock-index__head">
        <span className="stock-index__pin">
          <CashierIcon name="pin" />
          Pinned
        </span>
        <h3>Stock control center</h3>
        <p>The everyday stock shortcuts, in one place.</p>
        {restockCount > 0 && (
          <span className="stock-index__count">{restockCount} to restock</span>
        )}
      </div>

      <div className="stock-index__grid">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            className={`stock-index__tile${active === tile.key ? ' is-active' : ''}`}
            type="button"
            aria-pressed={active === tile.key}
            onClick={() => toggle(tile.key)}
          >
            <span className="stock-index__tile-top">
              <span className="stock-index__icon">
                <CashierIcon name={tile.icon} />
              </span>
              <span className="stock-index__chevron">
                <CashierIcon name="chevron" />
              </span>
            </span>
            <strong>{tile.title}</strong>
            <small>{tile.hint}</small>
          </button>
        ))}
      </div>

      {active && data && (
        <div className="stock-index__panel" role="region" aria-label="Stock preview">
          {active === 'health' && (
            <>
              <div className="stock-index__health">
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
              </div>
              <p className="stock-index__note">
                The reorder point is {threshold} units. Change it in the pharmacy threshold setting.
              </p>
            </>
          )}

          {active === 'receive' && (
            <>
              <div className="stock-index__chips">
                <span>
                  Open orders <b>{data.openOrders.length}</b>
                </span>
                <span>
                  Received today <b>{data.receivedToday.length}</b>
                </span>
                <span>
                  Received lots <b>{data.batches.filter((batch) => batch.stock > 0).length}</b>
                </span>
              </div>
              {data.openOrders.length === 0 ? (
                <p className="stock-index__empty">
                  No open purchase orders. Create one from Purchasing &amp; Receiving when a supplier
                  delivery is confirmed.
                </p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Supplier</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openOrders.slice(0, 6).map((order) => (
                      <tr key={order.id}>
                        <td className="stock-index__mono">{order.id}</td>
                        <td>{order.supplier}</td>
                        <td>{order.product}</td>
                        <td>{order.quantity}</td>
                        <td>{order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {active === 'expiry' && (
            <>
              <div className="stock-index__chips">
                <span>
                  Next 30 days <b>{data.soonExpiring.length}</b>
                </span>
                <span>
                  Next 90 days{' '}
                  <b>
                    {
                      data.batches.filter((batch) => {
                        const days = daysUntil(batch.expiry);
                        return days >= 0 && days <= 90;
                      }).length
                    }
                  </b>
                </span>
                <span>
                  Expired <b>{data.expired.length}</b>
                </span>
              </div>
              {data.soonExpiring.length === 0 ? (
                <p className="stock-index__empty">No batches expiring in the next 30 days.</p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Lot</th>
                      <th>Expiry</th>
                      <th>Days left</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.soonExpiring.map((batch) => (
                      <tr key={batch.id}>
                        <td>
                          <strong>{batch.product}</strong>
                        </td>
                        <td className="stock-index__mono">{batch.lot}</td>
                        <td>{shortDate(batch.expiry)}</td>
                        <td>{daysUntil(batch.expiry)}</td>
                        <td>{batch.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {active === 'batches' && (
            <>
              <div className="stock-index__chips">
                <span>
                  Lots tracked <b>{data.batches.length}</b>
                </span>
                <span>
                  Units in lots <b>{data.batches.reduce((sum, batch) => sum + batch.stock, 0)}</b>
                </span>
              </div>
              {data.batches.length === 0 ? (
                <p className="stock-index__empty">No batches recorded yet.</p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Product</th>
                      <th>Lot</th>
                      <th>Expiry</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.batches.slice(0, 8).map((batch) => (
                      <tr key={batch.id}>
                        <td className="stock-index__mono">{batch.id}</td>
                        <td>
                          <strong>{batch.product}</strong>
                        </td>
                        <td className="stock-index__mono">{batch.lot}</td>
                        <td>{shortDate(batch.expiry)}</td>
                        <td>{batch.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {active === 'order' && (
            <>
              <div className="stock-index__chips">
                <span>
                  Below reorder point <b>{restockProducts.length}</b>
                </span>
                <span>
                  Reorder point <b>{threshold}</b>
                </span>
              </div>
              {restockProducts.length === 0 ? (
                <p className="stock-index__empty">
                  Every product is above the {threshold}-unit reorder point.
                </p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>On hand</th>
                      <th>Suggested order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restockProducts.slice(0, 8).map((product) => (
                      <tr key={product.barcode}>
                        <td>
                          <strong>{product.product}</strong>
                        </td>
                        <td className="stock-index__mono">{product.barcode}</td>
                        <td>{product.stock}</td>
                        <td>
                          {Math.max(threshold * 2 - product.stock, threshold)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="stock-index__actions">
                <button
                  className="stock-index__action"
                  type="button"
                  onClick={onOrderRestock}
                  disabled={restockCount === 0}
                >
                  Download restock order
                </button>
              </div>
            </>
          )}

          {active === 'find' && (
            <>
              <label className="stock-index__search">
                <CashierIcon name="search" />
                <input
                  value={findQuery}
                  onChange={(event) => setFindQuery(event.target.value)}
                  placeholder="Product name, generic, brand, or barcode"
                  autoFocus
                />
              </label>
              {findResults.length === 0 ? (
                <p className="stock-index__empty">No product matches “{findQuery}”.</p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>Price</th>
                      <th>On hand</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findResults.map((product) => (
                      <tr key={product.barcode}>
                        <td>
                          <strong>{product.product}</strong>
                          <small className="stock-index__sub">{product.detail}</small>
                        </td>
                        <td className="stock-index__mono">{product.barcode}</td>
                        <td>{product.price}</td>
                        <td>{product.stock}</td>
                        <td>
                          <span
                            className={`stock-index__status stock-index__status--${
                              product.stock <= 0 ? 'out' : product.stock < threshold ? 'low' : 'ok'
                            }`}
                          >
                            {product.stock <= 0
                              ? 'Out of stock'
                              : product.stock < threshold
                                ? 'Low'
                                : 'In stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
