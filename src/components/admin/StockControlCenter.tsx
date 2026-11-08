import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CashierIcon } from '../cashier/CashierIcon';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import type { InventoryProduct } from '../../data/inventoryStore';
import {
  InventoryBatch,
  StockMovement,
  loadBatches,
  loadMovements,
  loadPurchaseOrders,
  saveBatches,
  saveMovements,
} from '../../data/operationsStore';
import { getSession } from '../../data/registerSession';
import { useToast } from '../toast';
import { initialBatches } from '../../pages/admin/OperationsPage';

type PanelKey =
  'receive' | 'health' | 'expiry' | 'batches' | 'order' | 'return' | 'adjustments' | 'find';

type StockControlCenterProps = {
  products: InventoryProduct[];
  threshold: number;
  restockCount: number;
  /** Downloads the restock order basis for the supplier. */
  onOrderRestock: () => void;
  /** Called after a return or adjustment changes stock, so the product list reloads. */
  onStockChanged?: () => void;
  /** The product list, always shown below the shortcut bar; results render at the bottom. */
  children?: ReactNode;
};

function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
}

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));

export function StockControlCenter({
  products,
  threshold,
  restockCount,
  onOrderRestock,
  onStockChanged,
  children,
}: StockControlCenterProps) {
  const [active, setActive] = useState<PanelKey | null>(null);
  const [findQuery, setFindQuery] = useState('');
  /** Bumped after a return or adjustment so the preview lists reload. */
  const [revision, setRevision] = useState(0);
  const panelRef = useRef<HTMLElement>(null);

  const handleStockSaved = () => {
    setRevision((count) => count + 1);
    onStockChanged?.();
  };

  // Results live at the bottom of the page, so bring them into view when a shortcut opens.
  useEffect(() => {
    if (active) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [active]);

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
    const returns = movements.filter((movement) => movement.kind === 'Return');
    const adjustments = movements.filter(
      (movement) => movement.kind === 'Adjustment' || movement.kind === 'Damaged',
    );
    const opened = getSession()?.openedAt;
    const returnsThisShift = returns.filter(
      (movement) => !opened || new Date(movement.date) >= new Date(opened),
    );
    const adjustmentsToday = adjustments.filter(
      (movement) => new Date(movement.date).toDateString() === new Date().toDateString(),
    );
    return {
      batches,
      orders,
      openOrders,
      receivedToday,
      soonExpiring,
      expired,
      returns,
      adjustments,
      returnsThisShift,
      adjustmentsToday,
    };
  }, [active, revision]);

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
      hint:
        active === 'batches'
          ? `${data?.batches.length ?? 0} lots tracked`
          : 'Lot numbers per batch',
    },
    {
      key: 'order',
      icon: 'suppliers',
      title: 'Order for restock',
      hint: restockCount > 0 ? `${restockCount} to reorder` : 'Nothing to reorder yet',
    },
    {
      key: 'return',
      icon: 'return',
      title: 'Return stocks',
      hint: data?.returnsThisShift.length
        ? `${data.returnsThisShift.length} to supplier this shift`
        : 'Expired or rejected items',
    },
    {
      key: 'adjustments',
      icon: 'adjustments',
      title: 'Adjustments',
      hint: data?.adjustmentsToday.length
        ? `${data.adjustmentsToday.length} corrected today`
        : 'Damaged or count errors',
    },
    {
      key: 'find',
      icon: 'products',
      title: 'Find a product',
      hint: 'Search right here',
    },
  ];

  const activeTile = tiles.find((tile) => tile.key === active);

  return (
    <>
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
      </section>

      {children}

      {active && data && (
        <section
          ref={panelRef}
          className="cashier-panel stock-index__panel stock-index__panel--below"
          role="region"
          aria-label="Stock preview"
        >
          <div className="stock-index__panel-head">
            <h3>{activeTile?.title}</h3>
            <button className="stock-index__back" type="button" onClick={() => setActive(null)}>
              Back to product list
            </button>
          </div>
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
                  No open purchase orders. Create one from Purchasing &amp; Receiving when a
                  supplier delivery is confirmed.
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
                        <td>{Math.max(threshold * 2 - product.stock, threshold)}</td>
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

          {active === 'return' && (
            <>
              <div className="stock-index__chips">
                <span>
                  Returned this shift <b>{data.returnsThisShift.length}</b>
                </span>
                <span>
                  Expired lots in stock <b>{data.expired.length}</b>
                </span>
                <span>
                  All supplier returns <b>{data.returns.length}</b>
                </span>
              </div>
              <StockWriteOffForm mode="return" batches={data.batches} onSaved={handleStockSaved} />
              {data.returns.length === 0 ? (
                <p className="stock-index__empty">
                  No supplier returns recorded yet. Use the form above when a delivery goes back
                  because it expired, arrived damaged, or was the wrong item.
                </p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Qty returned</th>
                      <th>Reason</th>
                      <th>Reference</th>
                      <th>Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.returns.slice(0, 8).map((movement) => (
                      <tr key={movement.id}>
                        <td className="stock-index__mono">
                          {new Date(movement.date).toLocaleDateString('en-PH')}
                        </td>
                        <td>
                          <strong>{movement.product}</strong>
                        </td>
                        <td>{Math.abs(movement.change)}</td>
                        <td>{movement.reason}</td>
                        <td className="stock-index__mono">{movement.reference}</td>
                        <td>{movement.staff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {active === 'adjustments' && (
            <>
              <div className="stock-index__chips">
                <span>
                  Adjusted today <b>{data.adjustmentsToday.length}</b>
                </span>
                <span>
                  Units written off{' '}
                  <b>
                    {data.adjustmentsToday.reduce(
                      (sum, movement) => sum + Math.max(-movement.change, 0),
                      0,
                    )}
                  </b>
                </span>
                <span>
                  All adjustments <b>{data.adjustments.length}</b>
                </span>
              </div>
              <StockWriteOffForm
                mode="adjustment"
                batches={data.batches}
                onSaved={handleStockSaved}
              />
              {data.adjustments.length === 0 ? (
                <p className="stock-index__empty">
                  No adjustments yet. Record broken packs, expired stock, or a count correction so
                  the shelf and the records always agree.
                </p>
              ) : (
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Change</th>
                      <th>Reason</th>
                      <th>Reference</th>
                      <th>Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.adjustments.slice(0, 8).map((movement) => (
                      <tr key={movement.id}>
                        <td className="stock-index__mono">
                          {new Date(movement.date).toLocaleDateString('en-PH')}
                        </td>
                        <td>
                          <strong>{movement.product}</strong>
                        </td>
                        <td
                          className={
                            movement.change > 0 ? 'movement-positive' : 'movement-negative'
                          }
                        >
                          {movement.change > 0 ? '+' : ''}
                          {movement.change}
                        </td>
                        <td>{movement.reason}</td>
                        <td className="stock-index__mono">{movement.reference}</td>
                        <td>{movement.staff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
        </section>
      )}
    </>
  );
}

/**
 * One small form that takes stock out of the shelf for a supplier return or an adjustment.
 * Returns go back to the supplier (expired or rejected), adjustments cover broken packs and
 * count corrections. Both keep a reason and a reference so the audit trail stays readable.
 */
function StockWriteOffForm({
  mode,
  batches,
  onSaved,
}: {
  mode: 'return' | 'adjustment';
  batches: InventoryBatch[];
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const live = getInventory();
  const [barcode, setBarcode] = useState(live[0]?.barcode ?? '');
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState<'remove' | 'add'>('remove');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [batchId, setBatchId] = useState('');

  const isReturn = mode === 'return';
  const product = live.find((item) => item.barcode === barcode);
  const productBatches = batches.filter((batch) => batch.barcode === barcode);
  const isExpired = batches.some((batch) => batch.id === batchId && daysUntil(batch.expiry) < 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const qty = Number(quantity);
    if (!product) {
      showToast('Pick a product first.', 'error');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('Enter how many units this is for.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast(
        isReturn
          ? 'Say why the items go back to the supplier.'
          : 'Say why this adjustment is needed.',
        'error',
      );
      return;
    }
    const inventory = getInventory();
    const change = direction === 'add' ? qty : -qty;
    const current = inventory.find((item) => item.barcode === barcode);
    if (!current) return;
    const nextStock = current.stock + change;
    if (nextStock < 0) {
      showToast('The shelf only has ' + current.stock + ' unit(s). Lower the quantity.', 'error');
      return;
    }
    saveInventory(
      inventory.map((item) =>
        item.barcode === barcode
          ? { ...item, stock: nextStock, status: stockStatus(nextStock) }
          : item,
      ),
    );
    if (batchId) {
      saveBatches(
        batches.map((batch) =>
          batch.id === batchId
            ? { ...batch, stock: Math.max(batch.stock - (isReturn ? qty : 0), 0) }
            : batch,
        ),
      );
    }
    const session = getSession();
    const staff = session?.onDutyNames?.[0] ?? session?.cashierName ?? 'Admin';
    const movement: StockMovement = {
      id: `${isReturn ? 'RET' : 'ADJ'}-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      product: product.product,
      kind: isReturn
        ? 'Return'
        : reason.toLowerCase().includes('expire')
          ? 'Damaged'
          : 'Adjustment',
      change,
      reference: reference.trim() || (isReturn ? 'Supplier return' : 'Manual adjustment'),
      staff,
      reason: reason.trim(),
    };
    saveMovements([movement, ...loadMovements()]);
    if (batchId && isReturn) {
      setReason('');
    }
    setQuantity('');
    setBatchId('');
    showToast(
      isReturn
        ? `${qty} unit(s) of ${product.product} returned to the supplier.`
        : `Stock adjusted by ${change > 0 ? '+' : ''}${change} for ${product.product}.`,
    );
    onSaved();
  }

  return (
    <form className="stock-index__form" onSubmit={submit}>
      <p className="stock-index__form-title">
        {isReturn
          ? 'Send stock back to the supplier: expired, rejected, or wrong item.'
          : 'Take stock out for damage, or add it back after a count correction.'}
      </p>
      <div className="stock-index__form-grid">
        <label>
          Product
          <select value={barcode} onChange={(event) => setBarcode(event.target.value)}>
            {live.map((item) => (
              <option value={item.barcode} key={item.barcode}>
                {item.product} · {item.stock} on hand
              </option>
            ))}
          </select>
        </label>
        <label>
          {isReturn ? 'Batch returned' : 'Batch (optional)'}
          <select value={batchId} onChange={(event) => setBatchId(event.target.value)}>
            <option value="">{isReturn ? 'No batch picked' : 'Whole product stock'}</option>
            {productBatches.map((batch) => (
              <option value={batch.id} key={batch.id}>
                {batch.lot} · expires {shortDate(batch.expiry)} · {batch.stock} in lot
              </option>
            ))}
          </select>
        </label>
        {!isReturn && (
          <label>
            Direction
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as 'remove' | 'add')}
            >
              <option value="remove">Remove stock</option>
              <option value="add">Add stock</option>
            </select>
          </label>
        )}
        <label>
          Quantity
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Units"
          />
        </label>
        <label className="stock-index__field-wide">
          Reason
          <input
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              isReturn
                ? 'e.g. Batch expired, supplier agreed to take it back'
                : 'e.g. Broken blister packs, counted 3 less'
            }
          />
        </label>
        <label>
          {isReturn ? 'Return slip / reference' : 'Reference (optional)'}
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={isReturn ? 'e.g. RS-24018' : 'e.g. ADJ-24018'}
          />
        </label>
      </div>
      {isReturn && batchId && (
        <p className="stock-index__note">
          {isExpired
            ? 'This batch is already expired, so it can go back to the supplier.'
            : 'This batch is still inside its expiry date. Make sure the supplier accepts the return.'}
        </p>
      )}
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit">
          {isReturn ? 'Record supplier return' : 'Save adjustment'}
        </button>
      </div>
    </form>
  );
}
