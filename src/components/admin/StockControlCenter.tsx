import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CashierIcon } from '../cashier/CashierIcon';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import type { InventoryProduct } from '../../data/inventoryStore';
import {
  InventoryBatch,
  StockMovement,
  initialBatches,
  loadBatches,
  loadMovements,
  saveBatches,
  saveMovements,
} from '../../data/operationsStore';
import { getSession } from '../../data/registerSession';
import { useToast } from '../toast';

type PanelKey =
  'products' | 'health' | 'receive' | 'expiry' | 'batches' | 'order' | 'return' | 'adjustments';

type StockControlCenterProps = {
  products: InventoryProduct[];
  threshold: number;
  restockCount: number;
  /** Downloads the restock order basis for the supplier. */
  onOrderRestock: () => void;
  /** Called after a delivery, return or adjustment changes stock, so the product list reloads. */
  onStockChanged?: () => void;
  /** The product list: shown inside the card when the Product list tab is open. */
  children?: ReactNode;
};

/** Lots that expire within this many days are "sell first". */
const EXPIRY_SOON_DAYS = 30;
/** Lots inside this window are listed on the expiry check so they can be watched. */
const EXPIRY_WATCH_DAYS = 90;

const SUPPLIER_KEY = 'dagohoy_demo_suppliers';
const DEFAULT_SUPPLIERS = ['Unilab, Inc.', 'Mercury Drug Wholesale', 'Natrapharm, Inc.'];

function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
}

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));

const shortDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** Plain-language time left on a lot: "Expired 3 days ago", "Today", "12 days". */
function daysLeftLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function lotState(days: number): 'expired' | 'soon' | 'watch' | 'ok' {
  if (days < 0) return 'expired';
  if (days <= EXPIRY_SOON_DAYS) return 'soon';
  if (days <= EXPIRY_WATCH_DAYS) return 'watch';
  return 'ok';
}

const LOT_LABEL = {
  expired: 'Expired',
  soon: 'Sell first',
  watch: 'Watch',
  ok: 'Good',
} as const;

const LOT_TONE = { expired: 'out', soon: 'low', watch: 'watch', ok: 'ok' } as const;

/** Suggested order: bring the shelf back up to twice the reorder point. */
const suggestedOrder = (stock: number, threshold: number) =>
  Math.max(threshold * 2 - stock, threshold);

function loadSupplierNames(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SUPPLIER_KEY) ?? 'null') as Array<{
      name?: string;
    }> | null;
    const names = (stored ?? []).map((supplier) => supplier.name?.trim()).filter(Boolean);
    return names.length ? (names as string[]) : DEFAULT_SUPPLIERS;
  } catch {
    return DEFAULT_SUPPLIERS;
  }
}

function staffName() {
  const session = getSession();
  return session?.onDutyNames?.[0] ?? session?.cashierName ?? 'Admin';
}

const movementId = (prefix: string) => `${prefix}-${Date.now().toString().slice(-6)}`;

export function StockControlCenter({
  products,
  threshold,
  restockCount,
  onOrderRestock,
  onStockChanged,
  children,
}: StockControlCenterProps) {
  const [active, setActive] = useState<PanelKey>('products');
  /** Bumped after stock is saved so the counts and lists reload. */
  const [revision, setRevision] = useState(0);
  /** A lot picked from Expiry check or Return stocks, pre-filled in the return form. */
  const [returnLot, setReturnLot] = useState('');

  const handleStockSaved = () => {
    setRevision((count) => count + 1);
    onStockChanged?.();
  };

  const openReturnFor = (batchId: string) => {
    setReturnLot(batchId);
    setActive('return');
  };

  const healthy = products.filter((product) => product.stock >= threshold).length;
  const low = products.filter((product) => product.stock > 0 && product.stock < threshold).length;
  const out = products.filter((product) => product.stock <= 0).length;
  const total = products.length || 1;
  const share = (count: number) => `${Math.round((count / total) * 100)}%`;
  const restockProducts = products
    .filter((product) => product.stock < threshold)
    .sort((a, b) => a.stock - b.stock);

  // Read on every change so each tab can show its live count, not only the open one.
  const data = useMemo(() => {
    const allBatches: InventoryBatch[] = loadBatches(initialBatches);
    const movements = loadMovements();
    const lots = allBatches
      .filter((batch) => batch.stock > 0)
      .map((batch) => ({ ...batch, days: daysUntil(batch.expiry) }))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
    const expired = lots.filter((lot) => lot.days < 0);
    const soon = lots.filter((lot) => lot.days >= 0 && lot.days <= EXPIRY_SOON_DAYS);
    const watch = lots.filter(
      (lot) => lot.days > EXPIRY_SOON_DAYS && lot.days <= EXPIRY_WATCH_DAYS,
    );
    // When a product has more than one good lot, the earliest-expiring one is sold first.
    const goodLots = new Map<string, number>();
    for (const lot of lots) {
      if (lot.days >= 0) goodLots.set(lot.barcode, (goodLots.get(lot.barcode) ?? 0) + 1);
    }
    const sellFirst = new Set<string>();
    const seen = new Set<string>();
    for (const lot of lots) {
      if (lot.days >= 0 && (goodLots.get(lot.barcode) ?? 0) > 1 && !seen.has(lot.barcode)) {
        seen.add(lot.barcode);
        sellFirst.add(lot.id);
      }
    }
    const received = movements.filter((movement) => movement.kind === 'Received');
    const returns = movements.filter((movement) => movement.kind === 'Return');
    const adjustments = movements.filter(
      (movement) =>
        movement.kind === 'Adjustment' ||
        movement.kind === 'Damaged' ||
        movement.kind === 'Customer return',
    );
    return {
      allBatches,
      lots,
      expired,
      soon,
      watch,
      sellFirst,
      received,
      receivedToday: received.filter((movement) => isToday(movement.date)),
      returns,
      adjustments,
      adjustmentsToday: adjustments.filter((movement) => isToday(movement.date)),
    };
    // products is a dependency so the lists refresh after the product list changes stock.
  }, [revision, products]);

  const tiles: Array<{
    key: PanelKey;
    icon: Parameters<typeof CashierIcon>[0]['name'];
    title: string;
    count: number;
    hint: string;
    /** Highlight the count when it is above zero: something needs doing. */
    alert?: boolean;
    about: string;
  }> = [
    {
      key: 'products',
      icon: 'products',
      title: 'Product list',
      count: products.length,
      hint: 'Search, add and edit',
      about: 'Every product on the shelf. Search, add a product, or edit its price and stock.',
    },
    {
      key: 'health',
      icon: 'reports',
      title: 'Stock health',
      count: low + out,
      hint: low + out > 0 ? 'Need attention' : 'All healthy',
      alert: low + out > 0,
      about: `Which products are low or already out. The reorder point is ${threshold} units.`,
    },
    {
      key: 'receive',
      icon: 'purchases',
      title: 'Receive stock',
      count: data.receivedToday.length,
      hint: 'Deliveries today',
      about:
        'Record a supplier delivery. Each delivery adds units to the shelf and saves its lot number and expiry date.',
    },
    {
      key: 'expiry',
      icon: 'batches',
      title: 'Expiry check',
      count: data.expired.length + data.soon.length,
      hint: `Expired or due in ${EXPIRY_SOON_DAYS} days`,
      alert: data.expired.length + data.soon.length > 0,
      about: `Lots that are expired or expire within ${EXPIRY_WATCH_DAYS} days, soonest first. Sell the near ones first and return the expired ones.`,
    },
    {
      key: 'batches',
      icon: 'inventory',
      title: 'Stock batches',
      count: data.lots.length,
      hint: 'Lots on the shelf',
      about:
        'Every lot that still has units, grouped by product. Sell the lot marked "Sell first" before the others.',
    },
    {
      key: 'order',
      icon: 'suppliers',
      title: 'Order for restock',
      count: restockCount,
      hint: 'Below reorder point',
      alert: restockCount > 0,
      about:
        'Products under the reorder point, with how many to order. Download the list to send to your supplier.',
    },
    {
      key: 'return',
      icon: 'return',
      title: 'Return stocks',
      count: data.expired.length,
      hint: 'Expired lots to return',
      alert: data.expired.length > 0,
      about: 'Send expired, damaged or wrong items back to the supplier and keep the return slip.',
    },
    {
      key: 'adjustments',
      icon: 'adjustments',
      title: 'Adjustments',
      count: data.adjustmentsToday.length,
      hint: 'Corrected today',
      about:
        'Take out broken or missing units, or fix the count after a stock take, so the records match the shelf.',
    },
  ];

  const activeTile = tiles.find((tile) => tile.key === active);
  const productByBarcode = new Map(products.map((product) => [product.barcode, product]));

  return (
    <>
      <section className="stock-index" aria-labelledby="stock-index-title">
        <div className="stock-index__head">
          <div>
            <h3 id="stock-index-title">Stock control center</h3>
            <p>Pick a task. Its tools open in the card below.</p>
          </div>
          {restockCount > 0 && (
            <button className="stock-index__count" type="button" onClick={() => setActive('order')}>
              {restockCount} to restock
            </button>
          )}
        </div>

        <div className="stock-index__grid" role="tablist" aria-label="Stock tasks">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              id={`stock-tab-${tile.key}`}
              className={`stock-index__tile${active === tile.key ? ' is-active' : ''}${
                tile.alert ? ' has-alert' : ''
              }`}
              data-task={tile.key}
              type="button"
              role="tab"
              aria-selected={active === tile.key}
              aria-controls="stock-index-panel"
              onClick={() => setActive(tile.key)}
            >
              <b
                className="stock-index__figure"
                aria-label={`${tile.count} ${tile.hint.toLowerCase()}`}
              >
                {tile.count}
              </b>
              <span className="stock-index__icon" aria-hidden="true">
                <CashierIcon name={tile.icon} />
              </span>
              <strong>{tile.title}</strong>
              <small>{tile.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <section
        id="stock-index-panel"
        className="stock-index__panel"
        role="tabpanel"
        aria-labelledby={`stock-tab-${active}`}
        key={active}
      >
        <div className="stock-index__panel-head">
          <h4>{activeTile?.title}</h4>
          <p>{activeTile?.about}</p>
        </div>

        {active === 'products' && <div className="stock-index__products">{children}</div>}

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
            {restockProducts.length === 0 ? (
              <p className="stock-index__empty">
                Every product is at or above the reorder point of {threshold} units.
              </p>
            ) : (
              <>
                <h5 className="stock-index__subhead">Needs attention</h5>
                <table className="stock-index__table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>On hand</th>
                      <th>Status</th>
                      <th>Short by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restockProducts.map((product) => (
                      <tr key={product.barcode}>
                        <td>
                          <strong>{product.product}</strong>
                          <small className="stock-index__sub">{product.detail}</small>
                        </td>
                        <td>
                          {product.stock} {product.unit.toLowerCase()}
                          {product.stock === 1 ? '' : 's'}
                        </td>
                        <td>
                          <span
                            className={`stock-index__status stock-index__status--${
                              product.stock <= 0 ? 'out' : 'low'
                            }`}
                          >
                            {product.stock <= 0 ? 'Out of stock' : 'Low stock'}
                          </span>
                        </td>
                        <td>{threshold - product.stock} to reorder point</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="stock-index__actions">
                  <button
                    className="stock-index__action"
                    type="button"
                    onClick={() => setActive('order')}
                  >
                    See restock order
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {active === 'receive' && (
          <>
            <ReceiveForm batches={data.allBatches} products={products} onSaved={handleStockSaved} />
            <h5 className="stock-index__subhead">Recent deliveries</h5>
            {data.received.length === 0 ? (
              <p className="stock-index__empty">
                No deliveries recorded yet. Use the form above when a supplier delivery arrives.
              </p>
            ) : (
              <table className="stock-index__table">
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Details</th>
                    <th>Receipt no.</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.received.slice(0, 8).map((movement) => (
                    <tr key={movement.id}>
                      <td className="stock-index__mono">{shortDateTime(movement.date)}</td>
                      <td>
                        <strong>{movement.product}</strong>
                      </td>
                      <td className="movement-positive">+{movement.change}</td>
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

        {active === 'expiry' && (
          <>
            <div className="stock-index__chips">
              <span className={data.expired.length ? 'is-out' : undefined}>
                Expired <b>{data.expired.length}</b>
              </span>
              <span className={data.soon.length ? 'is-low' : undefined}>
                Within {EXPIRY_SOON_DAYS} days <b>{data.soon.length}</b>
              </span>
              <span>
                {EXPIRY_SOON_DAYS + 1}–{EXPIRY_WATCH_DAYS} days <b>{data.watch.length}</b>
              </span>
            </div>
            {data.expired.length + data.soon.length + data.watch.length === 0 ? (
              <p className="stock-index__empty">
                No lot expires in the next {EXPIRY_WATCH_DAYS} days.
              </p>
            ) : (
              <table className="stock-index__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Lot</th>
                    <th>Expiry</th>
                    <th>Time left</th>
                    <th>Units</th>
                    <th>What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.expired, ...data.soon, ...data.watch].map((lot) => {
                    const state = lotState(lot.days);
                    return (
                      <tr key={lot.id}>
                        <td>
                          <strong>{lot.product}</strong>
                        </td>
                        <td className="stock-index__mono">{lot.lot}</td>
                        <td>{shortDate(lot.expiry)}</td>
                        <td>
                          <span
                            className={`stock-index__status stock-index__status--${LOT_TONE[state]}`}
                          >
                            {daysLeftLabel(lot.days)}
                          </span>
                        </td>
                        <td>{lot.stock}</td>
                        <td>
                          {state === 'expired' ? (
                            <button
                              className="stock-index__link"
                              type="button"
                              onClick={() => openReturnFor(lot.id)}
                            >
                              Return to supplier
                            </button>
                          ) : state === 'soon' ? (
                            'Sell this lot first'
                          ) : (
                            'Keep an eye on it'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {active === 'batches' && (
          <>
            <div className="stock-index__chips">
              <span>
                Lots on the shelf <b>{data.lots.length}</b>
              </span>
              <span>
                Units in these lots <b>{data.lots.reduce((sum, lot) => sum + lot.stock, 0)}</b>
              </span>
              <span>
                Products with lots <b>{new Set(data.lots.map((lot) => lot.barcode)).size}</b>
              </span>
            </div>
            {data.lots.length === 0 ? (
              <p className="stock-index__empty">
                No lots on the shelf yet. Lots are added when you receive a delivery.
              </p>
            ) : (
              <table className="stock-index__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Lot</th>
                    <th>Expiry</th>
                    <th>Units</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.lots]
                    .sort(
                      (a, b) =>
                        a.product.localeCompare(b.product) || a.expiry.localeCompare(b.expiry),
                    )
                    .map((lot) => {
                      const state = lotState(lot.days);
                      return (
                        <tr key={lot.id}>
                          <td>
                            <strong>{lot.product}</strong>
                            {productByBarcode.get(lot.barcode) && (
                              <small className="stock-index__sub">
                                {productByBarcode.get(lot.barcode)?.detail}
                              </small>
                            )}
                          </td>
                          <td className="stock-index__mono">{lot.lot}</td>
                          <td>{shortDate(lot.expiry)}</td>
                          <td>{lot.stock}</td>
                          <td>
                            <span
                              className={`stock-index__status stock-index__status--${LOT_TONE[state]}`}
                            >
                              {LOT_LABEL[state]}
                            </span>
                            {data.sellFirst.has(lot.id) && state !== 'soon' && (
                              <span className="stock-index__tag">Sell first</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </>
        )}

        {active === 'order' && (
          <>
            {restockProducts.length === 0 ? (
              <p className="stock-index__empty">
                Every product is above the {threshold}-unit reorder point. Nothing to order.
              </p>
            ) : (
              <table className="stock-index__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>On hand</th>
                    <th>Reorder point</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  {restockProducts.map((product) => (
                    <tr key={product.barcode}>
                      <td>
                        <strong>{product.product}</strong>
                        <small className="stock-index__sub">{product.detail}</small>
                      </td>
                      <td className="stock-index__mono">{product.barcode}</td>
                      <td>{product.stock}</td>
                      <td>{threshold}</td>
                      <td>
                        <strong>{suggestedOrder(product.stock, threshold)}</strong>{' '}
                        {product.unit.toLowerCase()}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="stock-index__note">
              The order quantity brings each product back to {threshold * 2} units, twice the
              reorder point. Check it against what the product really sells before you send it.
            </p>
            <div className="stock-index__actions">
              <button
                className="stock-index__action"
                type="button"
                onClick={onOrderRestock}
                disabled={restockCount === 0}
              >
                Download order list (CSV)
              </button>
            </div>
          </>
        )}

        {active === 'return' && (
          <>
            {data.expired.length > 0 && (
              <>
                <h5 className="stock-index__subhead">Expired lots still on the shelf</h5>
                <div className="stock-index__picks">
                  {data.expired.map((lot) => (
                    <button
                      key={lot.id}
                      type="button"
                      className={`stock-index__pick${returnLot === lot.id ? ' is-picked' : ''}`}
                      onClick={() => setReturnLot(lot.id)}
                    >
                      <strong>{lot.product}</strong>
                      <small>
                        Lot {lot.lot} · {lot.stock} units · {daysLeftLabel(lot.days).toLowerCase()}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            )}
            <StockWriteOffForm
              key={`return-${returnLot}`}
              mode="return"
              batches={data.allBatches}
              initialBatchId={returnLot}
              onSaved={() => {
                setReturnLot('');
                handleStockSaved();
              }}
            />
            <h5 className="stock-index__subhead">Returns to suppliers</h5>
            {data.returns.length === 0 ? (
              <p className="stock-index__empty">No supplier returns recorded yet.</p>
            ) : (
              <table className="stock-index__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Reason</th>
                    <th>Return slip</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.returns.slice(0, 8).map((movement) => (
                    <tr key={movement.id}>
                      <td className="stock-index__mono">{shortDateTime(movement.date)}</td>
                      <td>
                        <strong>{movement.product}</strong>
                      </td>
                      <td className="movement-negative">{movement.change}</td>
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
            <StockWriteOffForm
              mode="adjustment"
              batches={data.allBatches}
              onSaved={handleStockSaved}
            />
            <h5 className="stock-index__subhead">Recent adjustments</h5>
            {data.adjustments.length === 0 ? (
              <p className="stock-index__empty">No adjustments recorded yet.</p>
            ) : (
              <table className="stock-index__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Change</th>
                    <th>Reason</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.adjustments.slice(0, 8).map((movement) => (
                    <tr key={movement.id}>
                      <td className="stock-index__mono">{shortDateTime(movement.date)}</td>
                      <td>
                        <strong>{movement.product}</strong>
                      </td>
                      <td>{movement.kind === 'Adjustment' ? 'Count correction' : movement.kind}</td>
                      <td
                        className={movement.change > 0 ? 'movement-positive' : 'movement-negative'}
                      >
                        {movement.change > 0 ? '+' : ''}
                        {movement.change}
                      </td>
                      <td>{movement.reason}</td>
                      <td>{movement.staff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </>
  );
}

/**
 * Records a supplier delivery: adds the units to the product, saves the lot with its expiry
 * date (adding to the same lot if it is already on the shelf) and writes a Received movement.
 */
function ReceiveForm({
  batches,
  products,
  onSaved,
}: {
  batches: InventoryBatch[];
  products: InventoryProduct[];
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const suppliers = useMemo(loadSupplierNames, []);
  const [barcode, setBarcode] = useState(products[0]?.barcode ?? '');
  const [supplier, setSupplier] = useState(suppliers[0] ?? '');
  const [quantity, setQuantity] = useState('');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [reference, setReference] = useState('');

  const expiryDays = expiry ? daysUntil(expiry) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const qty = Number(quantity);
    const inventory = getInventory();
    const product = inventory.find((item) => item.barcode === barcode);
    if (!product) {
      showToast('Pick the product that arrived.', 'error');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      showToast('Enter how many units arrived, as a whole number.', 'error');
      return;
    }
    if (!lot.trim()) {
      showToast('Enter the lot number printed on the box.', 'error');
      return;
    }
    if (!expiry || daysUntil(expiry) < 0) {
      showToast('Enter an expiry date that has not passed yet.', 'error');
      return;
    }
    const nextStock = product.stock + qty;
    saveInventory(
      inventory.map((item) =>
        item.barcode === barcode
          ? { ...item, stock: nextStock, status: stockStatus(nextStock) }
          : item,
      ),
    );
    const lotCode = lot.trim().toUpperCase();
    const existing = batches.find(
      (batch) => batch.barcode === barcode && batch.lot === lotCode && batch.expiry === expiry,
    );
    saveBatches(
      existing
        ? batches.map((batch) =>
            batch.id === existing.id ? { ...batch, stock: batch.stock + qty } : batch,
          )
        : [
            ...batches,
            {
              id: movementId('B'),
              product: product.product,
              barcode,
              lot: lotCode,
              expiry,
              stock: qty,
              receivedAt: new Date().toISOString(),
            },
          ],
    );
    const movement: StockMovement = {
      id: movementId('RCV'),
      date: new Date().toISOString(),
      product: product.product,
      kind: 'Received',
      change: qty,
      reference: reference.trim() || 'No receipt no.',
      staff: staffName(),
      reason: `${supplier || 'Supplier'} · lot ${lotCode} · expires ${shortDate(expiry)}`,
    };
    saveMovements([movement, ...loadMovements()]);
    setQuantity('');
    setLot('');
    setExpiry('');
    setReference('');
    showToast(`${qty} unit(s) of ${product.product} received into lot ${lotCode}.`);
    onSaved();
  }

  return (
    <form className="stock-index__form" onSubmit={submit}>
      <p className="stock-index__form-title">
        Copy the details from the delivery receipt and the box label.
      </p>
      <div className="stock-index__form-grid">
        <label>
          Product
          <select value={barcode} onChange={(event) => setBarcode(event.target.value)}>
            {products.map((item) => (
              <option value={item.barcode} key={item.barcode}>
                {item.product} · {item.stock} on hand
              </option>
            ))}
          </select>
        </label>
        <label>
          Supplier
          <select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            {suppliers.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Units received
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="e.g. 100"
          />
        </label>
        <label>
          Lot number
          <input
            required
            value={lot}
            onChange={(event) => setLot(event.target.value)}
            placeholder="e.g. BGC-250114"
          />
        </label>
        <label>
          Expiry date
          <input
            type="date"
            required
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </label>
        <label>
          Delivery receipt no. (optional)
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="e.g. DR-10482"
          />
        </label>
      </div>
      {expiryDays !== null && expiryDays >= 0 && expiryDays <= EXPIRY_WATCH_DAYS && (
        <p className="stock-index__warn">
          This lot expires in {expiryDays} day{expiryDays === 1 ? '' : 's'}. Check that the supplier
          agreed to send short-dated stock.
        </p>
      )}
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit">
          Receive delivery
        </button>
      </div>
    </form>
  );
}

type AdjustmentType = 'damaged' | 'missing' | 'count-less' | 'count-more' | 'customer-return';

const ADJUSTMENT_TYPES: Record<
  AdjustmentType,
  { label: string; add: boolean; kind: 'Damaged' | 'Adjustment' | 'Customer return' }
> = {
  damaged: { label: 'Damaged or broken (take out)', add: false, kind: 'Damaged' },
  missing: { label: 'Missing or lost (take out)', add: false, kind: 'Adjustment' },
  'count-less': { label: 'Stock take: fewer than recorded', add: false, kind: 'Adjustment' },
  'count-more': { label: 'Stock take: more than recorded', add: true, kind: 'Adjustment' },
  'customer-return': {
    label: 'Customer returned an item (put back)',
    add: true,
    kind: 'Customer return',
  },
};
/**
 * One small form that changes shelf stock for a supplier return or an adjustment.
 * Returns go back to the supplier (expired, damaged or wrong item). Adjustments cover broken
 * packs, missing units and stock-take corrections. When a lot is picked, its units change too.
 * Both keep a reason and a reference so the audit trail stays readable.
 */
export function StockWriteOffForm({
  mode,
  batches,
  initialBatchId = '',
  onSaved,
}: {
  mode: 'return' | 'adjustment';
  batches: InventoryBatch[];
  initialBatchId?: string;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const live = getInventory();
  const preset = batches.find((batch) => batch.id === initialBatchId);
  const isReturn = mode === 'return';
  const [barcode, setBarcode] = useState(preset?.barcode ?? live[0]?.barcode ?? '');
  const [quantity, setQuantity] = useState(preset ? String(preset.stock) : '');
  const [type, setType] = useState<AdjustmentType>('damaged');
  const [reason, setReason] = useState(preset && daysUntil(preset.expiry) < 0 ? 'Lot expired' : '');
  const [reference, setReference] = useState('');
  const [batchId, setBatchId] = useState(preset?.id ?? '');

  const product = live.find((item) => item.barcode === barcode);
  const productBatches = batches.filter((batch) => batch.barcode === barcode && batch.stock > 0);
  const batch = batches.find((item) => item.id === batchId);
  const adjustment = ADJUSTMENT_TYPES[type];
  const adds = !isReturn && adjustment.add;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const qty = Number(quantity);
    if (!product) {
      showToast('Pick a product first.', 'error');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      showToast('Enter how many units, as a whole number.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast(
        isReturn ? 'Say why the items go back to the supplier.' : 'Say why this change is needed.',
        'error',
      );
      return;
    }
    const inventory = getInventory();
    const current = inventory.find((item) => item.barcode === barcode);
    if (!current) return;
    const change = adds ? qty : -qty;
    const nextStock = current.stock + change;
    if (nextStock < 0) {
      showToast(`The shelf only has ${current.stock} unit(s). Lower the quantity.`, 'error');
      return;
    }
    if (batch && !adds && qty > batch.stock) {
      showToast(`Lot ${batch.lot} only has ${batch.stock} unit(s). Lower the quantity.`, 'error');
      return;
    }
    saveInventory(
      inventory.map((item) =>
        item.barcode === barcode
          ? { ...item, stock: nextStock, status: stockStatus(nextStock) }
          : item,
      ),
    );
    if (batch) {
      saveBatches(
        batches.map((item) =>
          item.id === batch.id ? { ...item, stock: Math.max(item.stock + change, 0) } : item,
        ),
      );
    }
    const lotNote = batch ? ` (lot ${batch.lot})` : '';
    const movement: StockMovement = {
      id: movementId(isReturn ? 'RET' : 'ADJ'),
      date: new Date().toISOString(),
      product: product.product,
      kind: isReturn ? 'Return' : adjustment.kind,
      change,
      reference: reference.trim() || (isReturn ? 'No return slip' : 'Manual adjustment'),
      staff: staffName(),
      reason: `${reason.trim()}${lotNote}`,
    };
    saveMovements([movement, ...loadMovements()]);
    setQuantity('');
    setReason('');
    setReference('');
    setBatchId('');
    showToast(
      isReturn
        ? `${qty} unit(s) of ${product.product} returned to the supplier.`
        : `Stock ${adds ? 'added' : 'taken out'}: ${change > 0 ? '+' : ''}${change} ${product.product}.`,
    );
    onSaved();
  }

  return (
    <form className="stock-index__form" onSubmit={submit}>
      <p className="stock-index__form-title">
        {isReturn
          ? 'Pick the lot going back so its units come off the shelf, then note the return slip.'
          : 'Pick what happened. If you know the lot, pick it too so the lot count stays right.'}
      </p>
      <div className="stock-index__form-grid">
        <label>
          Product
          <select
            value={barcode}
            onChange={(event) => {
              setBarcode(event.target.value);
              setBatchId('');
            }}
          >
            {live.map((item) => (
              <option value={item.barcode} key={item.barcode}>
                {item.product} · {item.stock} on hand
              </option>
            ))}
          </select>
        </label>
        {!isReturn && (
          <label>
            What happened
            <select
              value={type}
              onChange={(event) => setType(event.target.value as AdjustmentType)}
            >
              {Object.entries(ADJUSTMENT_TYPES).map(([key, value]) => (
                <option value={key} key={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {isReturn ? 'Lot going back' : 'Lot (optional)'}
          <select value={batchId} onChange={(event) => setBatchId(event.target.value)}>
            <option value="">{isReturn ? 'Not from a recorded lot' : 'Not sure / any lot'}</option>
            {productBatches.map((item) => (
              <option value={item.id} key={item.id}>
                {item.lot} · expires {shortDate(item.expiry)} · {item.stock} in lot
              </option>
            ))}
          </select>
        </label>
        <label>
          {adds ? 'Units to add' : isReturn ? 'Units going back' : 'Units to take out'}
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
                ? 'e.g. Lot expired, supplier agreed to take it back'
                : type === 'customer-return'
                  ? 'e.g. Unopened box, bought on receipt DP-123456'
                  : 'e.g. 3 blister packs crushed in storage'
            }
          />
        </label>
        <label>
          {isReturn ? 'Return slip no. (optional)' : 'Reference (optional)'}
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={isReturn ? 'e.g. RS-24018' : 'e.g. Count sheet 11/09'}
          />
        </label>
      </div>
      {isReturn && batch && (
        <p className={daysUntil(batch.expiry) < 0 ? 'stock-index__note' : 'stock-index__warn'}>
          {daysUntil(batch.expiry) < 0
            ? `Lot ${batch.lot} expired on ${shortDate(batch.expiry)}, so it can go back to the supplier.`
            : `Lot ${batch.lot} is still good until ${shortDate(batch.expiry)}. Make sure the supplier accepts the return.`}
        </p>
      )}
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit">
          {isReturn ? 'Record supplier return' : adds ? 'Add stock' : 'Take out stock'}
        </button>
      </div>
    </form>
  );
}
