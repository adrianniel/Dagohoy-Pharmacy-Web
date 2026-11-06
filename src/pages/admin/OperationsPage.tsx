import { FormEvent, useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { useToast } from '../../components/toast';
import { getInventory, saveInventory, stockStatus } from '../../data/inventoryStore';
import {
  loadMovements,
  InventoryBatch,
  saveMovements,
  StockMovement,
} from '../../data/operationsStore';

const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Starting batch lots, used as a fallback by the stock control center previews. */
export const initialBatches: InventoryBatch[] = [
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

export function OperationsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [movements, setMovements] = useState(loadMovements);
  const [modal, setModal] = useState<'adjustment' | null>(null);
  const { showToast } = useToast();
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
      <div className="operations-demo-banner operations-demo-banner--with-action">
        <span>
          Demo inventory workspace · quantities and documents are stored in this browser only.
        </span>
        <button
          className="cashier-primary-action operations-demo-action"
          type="button"
          onClick={() => setModal('adjustment')}
        >
          Adjust stock <span>＋</span>
        </button>
      </div>
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
        <div
          className="cashier-table-wrap"
          role="region"
          aria-label="Stock movements table"
          tabIndex={0}
        >
          <table className="cashier-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date &amp; time</th>
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
      {modal === 'adjustment' && (
        <AdjustmentForm onClose={() => setModal(null)} onSave={saveAdjustment} />
      )}
    </div>
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
