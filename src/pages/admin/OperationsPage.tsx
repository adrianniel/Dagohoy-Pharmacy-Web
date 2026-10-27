import { FormEvent, useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { useToast } from '../../components/toast';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import {
  loadMovements,
  loadPurchaseOrders,
  PurchaseOrder,
  InventoryBatch,
  loadBatches,
  saveBatches,
  saveMovements,
  savePurchaseOrders,
  StockMovement,
} from '../../data/operationsStore';

type OperationsSection = 'batches' | 'purchases' | 'stock';
const vendors = ['Unilab, Inc.', 'Mercury Drug Wholesale', 'Natrapharm, Inc.'];
function getVendors() {
  try {
    const saved = JSON.parse(localStorage.getItem('dagohoy_demo_suppliers') ?? 'null') as Array<{
      name: string;
    }> | null;
    return saved?.length ? saved.map((supplier) => supplier.name) : vendors;
  } catch {
    return vendors;
  }
}
const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const initialBatches: InventoryBatch[] = [
  {
    id: 'B-10248',
    product: 'Biogesic 500mg',
    barcode: '4800016642012',
    lot: 'BGC-240811',
    expiry: plusDays(23),
    stock: 40,
  },
  {
    id: 'B-10221',
    product: 'Neozep Forte',
    barcode: '4806516731010',
    lot: 'NZF-240405',
    expiry: plusDays(68),
    stock: 19,
  },
  {
    id: 'B-10184',
    product: 'Bioflu',
    barcode: '4800361412025',
    lot: 'BIO-231206',
    expiry: plusDays(148),
    stock: 12,
  },
  {
    id: 'B-10172',
    product: 'Tuseran Forte',
    barcode: '4800016021060',
    lot: 'TSF-240210',
    expiry: plusDays(320),
    stock: 30,
  },
];
const shortDate = (date: string) => {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : new Date(date);
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(parsedDate);
};

export function OperationsPage({ section }: { section: OperationsSection }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [batches, setBatches] = useState(() => loadBatches(initialBatches));
  const [orders, setOrders] = useState(loadPurchaseOrders);
  const [movements, setMovements] = useState(loadMovements);
  const [modal, setModal] = useState<'purchase' | 'adjustment' | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const { showToast } = useToast();
  const filteredBatches = useMemo(
    () =>
      batches.filter((batch) => {
        const matchesQuery = `${batch.product} ${batch.lot} ${batch.barcode}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const days = daysUntil(batch.expiry);
        const matchesFilter =
          filter === 'all' ||
          (filter === '30' && days >= 0 && days <= 30) ||
          (filter === '90' && days >= 0 && days <= 90) ||
          (filter === 'expired' && days < 0);
        return matchesQuery && matchesFilter;
      }),
    [batches, filter, query],
  );
  const filteredMovements = useMemo(
    () =>
      movements.filter(
        (movement) =>
          `${movement.id} ${movement.product} ${movement.reference} ${movement.reason}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === 'all' || movement.kind === filter),
      ),
    [filter, movements, query],
  );
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          `${order.id} ${order.supplier} ${order.product}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === 'all' || order.status === filter),
      ),
    [filter, orders, query],
  );
  const labels: Record<OperationsSection, [string, string]> = {
    batches: [
      'Batch & expiry tracking',
      'Monitor lot numbers and expiry dates to support safe stock rotation.',
    ],
    purchases: [
      'Purchasing & receiving',
      'Create supplier orders and record incoming stock against inventory.',
    ],
    stock: [
      'Stock movement history',
      'Review receipts, adjustments, damages, and other inventory changes.',
    ],
  };

  function saveOrder(order: PurchaseOrder) {
    const next = [order, ...orders];
    setOrders(next);
    savePurchaseOrders(next);
    setModal(null);
    showToast(`${order.id} saved as a local demo order.`);
  }

  function receiveOrder(order: PurchaseOrder, lot: string, expiry: string) {
    const inventory = getInventory();
    const product = inventory.find((item) => item.barcode === order.productBarcode);
    if (product) {
      const quantity = product.stock + order.quantity;
      saveInventory(
        inventory.map((item) =>
          item.barcode === product.barcode
            ? { ...item, stock: quantity, status: stockStatus(quantity) }
            : item,
        ),
      );
      const receivedBatch: InventoryBatch = {
        id: `B-${Date.now().toString().slice(-6)}`,
        product: product.product,
        barcode: product.barcode,
        lot,
        expiry,
        stock: order.quantity,
      };
      const nextBatches = [receivedBatch, ...batches];
      setBatches(nextBatches);
      saveBatches(nextBatches);
      const receipt: StockMovement = {
        id: `MOV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        product: product.product,
        kind: 'Received',
        change: order.quantity,
        reference: order.id,
        staff: 'Demo admin',
        reason: `Received from ${order.supplier}`,
      };
      const nextMovements = [receipt, ...movements];
      setMovements(nextMovements);
      saveMovements(nextMovements);
    }
    const nextOrders = orders.map((item) =>
      item.id === order.id ? { ...item, status: 'Received' as const } : item,
    );
    setOrders(nextOrders);
    savePurchaseOrders(nextOrders);
    setReceivingOrder(null);
    showToast(`${order.id} marked received. Demo stock updated locally.`);
  }

  function saveAdjustment(movement: StockMovement, productBarcode: string) {
    const inventory = getInventory();
    const product = inventory.find((item) => item.barcode === productBarcode);
    const newStock = (product?.stock ?? 0) + movement.change;
    if (!product || newStock < 0) {
      showToast('Adjustment cannot reduce available stock below zero.', 'error');
      return;
    }
    saveInventory(
      inventory.map((item) =>
        item.barcode === productBarcode
          ? { ...item, stock: newStock, status: stockStatus(newStock) }
          : item,
      ),
    );
    const next = [movement, ...movements];
    setMovements(next);
    saveMovements(next);
    setModal(null);
    showToast('Stock adjustment saved to this browser.');
  }

  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Inventory operations"
        title={labels[section][0]}
        description={labels[section][1]}
        action={
          section === 'purchases' ? (
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setModal('purchase')}
            >
              Create purchase order <span>＋</span>
            </button>
          ) : section === 'stock' ? (
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setModal('adjustment')}
            >
              Adjust stock <span>＋</span>
            </button>
          ) : undefined
        }
      />
      <div className="operations-demo-banner">
        Demo inventory workspace · quantities and documents are stored in this browser only.
      </div>
      {section === 'batches' && (
        <>
          <div className="cashier-summary-grid">
            <OperationStat
              label="Tracked lots"
              value={String(batches.length)}
              detail="Illustrative lot records"
            />
            <OperationStat
              label="Expiring in 30 days"
              value={String(
                batches.filter(
                  (batch) => daysUntil(batch.expiry) >= 0 && daysUntil(batch.expiry) <= 30,
                ).length,
              )}
              detail="Prioritize these batches"
            />
            <OperationStat
              label="Expiring in 90 days"
              value={String(
                batches.filter(
                  (batch) => daysUntil(batch.expiry) >= 0 && daysUntil(batch.expiry) <= 90,
                ).length,
              )}
              detail="FEFO stock rotation"
            />
            <OperationStat
              label="Expired lots"
              value={String(batches.filter((batch) => daysUntil(batch.expiry) < 0).length)}
              detail="Quarantine and review"
            />
          </div>
          <section className="cashier-panel cashier-list-panel">
            <div className="cashier-list-toolbar">
              <SearchField
                query={query}
                setQuery={setQuery}
                placeholder="Search product, lot, or barcode"
              />
              <select
                className="operations-select"
                aria-label="Filter expiry"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All expiry dates</option>
                <option value="30">Next 30 days</option>
                <option value="90">Next 90 days</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="cashier-table-wrap">
              <table className="cashier-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Lot / batch</th>
                    <th>Expiry date</th>
                    <th>Batch date</th>
                    <th>Days remaining</th>
                    <th>Quantity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch) => {
                    const days = daysUntil(batch.expiry);
                    return (
                      <tr key={batch.id}>
                        <td>
                          <strong>{batch.product}</strong>
                          <small>{batch.barcode}</small>
                        </td>
                        <td className="cashier-mono">{batch.lot}</td>
                        <td>{shortDate(batch.expiry)}</td>
                        <td>
                          {batch.receivedAt
                            ? new Intl.DateTimeFormat('en-PH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(batch.receivedAt))
                            : '—'}
                        </td>
                        <td>
                          <span
                            className={`expiry-count${days <= 30 ? ' is-urgent' : days <= 90 ? ' is-warning' : ''}`}
                          >
                            {days} days
                          </span>
                        </td>
                        <td>{batch.stock}</td>
                        <td>
                          <button
                            type="button"
                            className="cashier-view-button"
                            onClick={() =>
                              showToast(
                                `${batch.product} · lot ${batch.lot} · expires ${shortDate(batch.expiry)}`,
                                'info',
                              )
                            }
                          >
                            View batch
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="cashier-table-footer">
              <span>{batches.length} batch records</span>
              <span>Batch dates are recorded when stock is received.</span>
            </div>
          </section>
        </>
      )}
      {section === 'purchases' && (
        <section className="cashier-panel cashier-list-panel">
          <div className="operations-summary-row">
            <div>
              <strong>{orders.filter((order) => order.status !== 'Received').length}</strong>
              <span>Open purchase orders</span>
            </div>
            <div>
              <strong>{orders.filter((order) => order.status === 'Received').length}</strong>
              <span>Received in demo</span>
            </div>
            <div>
              <strong>{getVendors().length}</strong>
              <span>Sample suppliers</span>
            </div>
          </div>
          <div className="cashier-list-toolbar">
            <SearchField
              query={query}
              setQuery={setQuery}
              placeholder="Search order, supplier, product"
            />
            <select
              className="operations-select"
              aria-label="Filter orders"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All order statuses</option>
              <option>Draft</option>
              <option>Ordered</option>
              <option>Received</option>
            </select>
          </div>
          <div className="cashier-table-wrap">
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.id}</strong>
                    </td>
                    <td>{order.supplier}</td>
                    <td>{order.product}</td>
                    <td>{order.quantity}</td>
                    <td>{shortDate(order.created)}</td>
                    <td>
                      <StatusBadge value={order.status} />
                    </td>
                    <td>
                      {order.status !== 'Received' ? (
                        <button
                          type="button"
                          className="cashier-view-button"
                          onClick={() => setReceivingOrder(order)}
                        >
                          Receive stock
                        </button>
                      ) : (
                        <span className="muted">Complete</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cashier-table-footer">
            <span>
              {filteredOrders.length} of {orders.length} local demo orders
            </span>
            <span>Receiving updates demo inventory and movement history.</span>
          </div>
        </section>
      )}
      {section === 'stock' && (
        <section className="cashier-panel cashier-list-panel">
          <div className="cashier-list-toolbar">
            <SearchField
              query={query}
              setQuery={setQuery}
              placeholder="Search product, reference, reason"
            />
            <select
              className="operations-select"
              aria-label="Filter movement type"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All movement types</option>
              <option>Received</option>
              <option>Adjustment</option>
              <option>Damaged</option>
              <option>Sale</option>
              <option>Return</option>
            </select>
          </div>
          <div className="cashier-table-wrap">
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date & time</th>
                  <th>Product</th>
                  <th>Movement</th>
                  <th>Change</th>
                  <th>Reason / source</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length ? (
                  filteredMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>
                        <strong>{movement.id}</strong>
                      </td>
                      <td>{new Date(movement.date).toLocaleString('en-PH')}</td>
                      <td>{movement.product}</td>
                      <td>
                        <StatusBadge value={movement.kind} />
                      </td>
                      <td
                        className={movement.change > 0 ? 'movement-positive' : 'movement-negative'}
                      >
                        {movement.change > 0 ? '+' : ''}
                        {movement.change}
                      </td>
                      <td>
                        {movement.reason} <small>{movement.reference}</small>
                      </td>
                      <td>{movement.staff}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="operations-empty">
                      No demo adjustments recorded yet. Receive an order or create an adjustment to
                      start the audit trail.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {modal === 'purchase' && (
        <PurchaseOrderForm onClose={() => setModal(null)} onSave={saveOrder} />
      )}
      {modal === 'adjustment' && (
        <AdjustmentForm onClose={() => setModal(null)} onSave={saveAdjustment} />
      )}
      {receivingOrder && (
        <ReceiveOrderForm
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onReceive={(lot, expiry) => receiveOrder(receivingOrder, lot, expiry)}
        />
      )}
    </div>
  );
}

function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
}
function OperationStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
function SearchField({
  query,
  setQuery,
  placeholder,
}: {
  query: string;
  setQuery: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="cashier-search-field cashier-search-field--wide">
      <CashierIcon name="search" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function PurchaseOrderForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (order: PurchaseOrder) => void;
}) {
  const products = getInventory();
  const suppliers = getVendors();
  const [supplier, setSupplier] = useState(suppliers[0] ?? 'Supplier');
  const [barcode, setBarcode] = useState(products[0]?.barcode ?? '');
  const [quantity, setQuantity] = useState('');
  return (
    <div className="pos-modal-backdrop">
      <form
        className="pos-payment-modal"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const product = products.find((item) => item.barcode === barcode);
          if (!product) return;
          onSave({
            id: `PO-${Date.now().toString().slice(-6)}`,
            supplier,
            product: product.product,
            productBarcode: barcode,
            quantity: Number(quantity),
            created: new Date().toISOString(),
            status: 'Ordered',
          });
        }}
      >
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close purchase order"
        >
          ×
        </button>
        <p className="eyebrow">Purchasing · demo mode</p>
        <h2>New purchase order</h2>
        <p className="inventory-form-note">
          Record one product per demo order. Saved orders can be received into the local inventory.
        </p>
        <label>
          Supplier
          <select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            {suppliers.map((vendor) => (
              <option key={vendor}>{vendor}</option>
            ))}
          </select>
        </label>
        <label>
          Product
          <select value={barcode} onChange={(event) => setBarcode(event.target.value)}>
            {products.map((product) => (
              <option value={product.barcode} key={product.barcode}>
                {product.product}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order quantity
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <button className="pos-checkout-button" type="submit">
          Save purchase order
        </button>
      </form>
    </div>
  );
}

function ReceiveOrderForm({
  order,
  onClose,
  onReceive,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onReceive: (lot: string, expiry: string) => void;
}) {
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  return (
    <div className="pos-modal-backdrop">
      <form
        className="pos-payment-modal"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onReceive(lot.trim(), expiry);
        }}
      >
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close receiving form"
        >
          ×
        </button>
        <p className="eyebrow">Goods receiving · demo</p>
        <h2>Receive {order.id}</h2>
        <div className="pos-payment-total">
          <span>{order.product} · ordered quantity</span>
          <strong>{order.quantity}</strong>
        </div>
        <p className="inventory-form-note">
          Record the supplier batch and expiry printed on the delivered stock.
        </p>
        <label>
          Supplier lot / batch number
          <input required value={lot} onChange={(event) => setLot(event.target.value)} />
        </label>
        <label>
          Expiry date
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            required
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </label>
        <button className="pos-checkout-button" type="submit">
          Receive stock and create batch
        </button>
      </form>
    </div>
  );
}

function AdjustmentForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (movement: StockMovement, barcode: string) => void;
}) {
  const products = getInventory();
  const [barcode, setBarcode] = useState(products[0]?.barcode ?? '');
  const [kind, setKind] = useState<'Adjustment' | 'Damaged' | 'Return'>('Adjustment');
  const [direction, setDirection] = useState<'add' | 'remove'>('remove');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  return (
    <div className="pos-modal-backdrop">
      <form
        className="pos-payment-modal"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const product = products.find((item) => item.barcode === barcode);
          if (!product) return;
          const qty = Number(quantity);
          const change = direction === 'add' ? qty : -qty;
          onSave(
            {
              id: `ADJ-${Date.now().toString().slice(-6)}`,
              date: new Date().toISOString(),
              product: product.product,
              kind,
              change,
              reference: 'Manual adjustment',
              staff: 'Demo admin',
              reason,
            },
            barcode,
          );
        }}
      >
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close stock adjustment"
        >
          ×
        </button>
        <p className="eyebrow">Inventory control · demo</p>
        <h2>Adjust stock</h2>
        <p className="inventory-form-note">
          Every adjustment is recorded in the local movement history.
        </p>
        <label>
          Product
          <select value={barcode} onChange={(event) => setBarcode(event.target.value)}>
            {products.map((product) => (
              <option value={product.barcode} key={product.barcode}>
                {product.product} · {product.stock} on hand
              </option>
            ))}
          </select>
        </label>
        <div className="inventory-form-row">
          <label>
            Reason
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="Adjustment">Count correction</option>
              <option value="Damaged">Damaged / expired</option>
              <option value="Return">Customer return</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as typeof direction)}
            >
              <option value="remove">Remove stock</option>
              <option value="add">Add stock</option>
            </select>
          </label>
        </div>
        <label>
          Quantity
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label>
          Reason / note
          <input
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Physical count variance"
          />
        </label>
        <button className="pos-checkout-button" type="submit">
          Save adjustment
        </button>
      </form>
    </div>
  );
}
