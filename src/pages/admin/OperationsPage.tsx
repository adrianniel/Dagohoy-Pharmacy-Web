import { FormEvent, useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { useToast } from '../../components/toast';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
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

type MovementView = 'all' | 'in' | 'out' | 'adjust';

const STOCK_IN_KINDS: StockMovement['kind'][] = ['Received'];
const STOCK_OUT_KINDS: StockMovement['kind'][] = ['Sale', 'Damaged', 'Return'];

export function OperationsPage() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<MovementView>('all');
  const [movements, setMovements] = useState(loadMovements);
  const { showToast } = useToast();

  const stockIn = movements.filter((movement) => STOCK_IN_KINDS.includes(movement.kind));
  const stockOut = movements.filter((movement) => STOCK_OUT_KINDS.includes(movement.kind));

  const visibleMovements = useMemo(() => {
    const kinds = view === 'in' ? STOCK_IN_KINDS : view === 'out' ? STOCK_OUT_KINDS : null;
    const needle = query.trim().toLowerCase();
    return movements.filter(
      (movement) =>
        (!kinds || kinds.includes(movement.kind)) &&
        `${movement.id} ${movement.product} ${movement.reference} ${movement.reason}`
          .toLowerCase()
          .includes(needle),
    );
  }, [movements, query, view]);

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
    setView('all');
    showToast('Stock adjustment saved to this browser.');
  }

  const items: Array<ControlItem<MovementView>> = [
    {
      key: 'all',
      icon: 'stock',
      title: 'All movements',
      hint: 'Every stock change',
      tone: 'forest',
      count: movements.length,
      about: 'Every time stock went in or out, newest first. Saved in this browser only.',
    },
    {
      key: 'in',
      icon: 'purchases',
      title: 'Stock in',
      hint: 'Deliveries received',
      tone: 'blue',
      count: stockIn.length,
      about: 'Supplier deliveries that added units to the shelf.',
    },
    {
      key: 'out',
      icon: 'return',
      title: 'Stock out',
      hint: 'Sales, damaged, returns',
      tone: 'rose',
      count: stockOut.length,
      about: 'Units that left the shelf through sales, damage or returns to the supplier.',
    },
    {
      key: 'adjust',
      icon: 'adjustments',
      title: 'Adjust stock',
      hint: 'Fix a count',
      tone: 'amber',
      about: 'Correct the shelf count. Every adjustment is added to the movement history.',
    },
  ];
  const activeItem = items.find((item) => item.key === view) ?? items[0];

  return (
    <div className="cashier-page">
      <ControlDeck
        id="stock-moves"
        title="Stock movements"
        subtitle="Pick a view. Its list or form opens in the card below."
        items={items}
        active={view}
        onSelect={setView}
      />
      <ControlPanel
        id="stock-moves"
        activeKey={view}
        title={activeItem.title}
        about={activeItem.about}
      >
        {view === 'adjust' ? (
          <AdjustmentForm onSave={saveAdjustment} />
        ) : (
          <>
            <div className="cashier-list-toolbar">
              <SearchField
                query={query}
                setQuery={setQuery}
                placeholder="Search product, reference, reason"
              />
            </div>
            <MovementTable movements={visibleMovements} />
          </>
        )}
      </ControlPanel>
    </div>
  );
}

function MovementTable({ movements }: { movements: StockMovement[] }) {
  return (
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
          {movements.length ? (
            movements.map((movement) => (
              <tr key={movement.id}>
                <td>
                  <strong>{movement.id}</strong>
                </td>
                <td>{new Date(movement.date).toLocaleString('en-PH')}</td>
                <td>{movement.product}</td>
                <td>
                  <StatusBadge value={movement.kind} />
                </td>
                <td className={movement.change > 0 ? 'movement-positive' : 'movement-negative'}>
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
                No stock movements here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
  onSave,
}: {
  onSave: (movement: StockMovement, barcode: string) => void;
}) {
  const products = getInventory();
  const [barcode, setBarcode] = useState(products[0]?.barcode ?? '');
  const [kind, setKind] = useState<'Adjustment' | 'Damaged' | 'Return'>('Adjustment');
  const [direction, setDirection] = useState<'add' | 'remove'>('remove');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  return (
    <form
      className="stock-index__form"
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
      <div className="stock-index__form-grid">
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
        <label className="stock-index__field-wide">
          Reason / note
          <input
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Physical count variance"
          />
        </label>
      </div>
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit">
          Save adjustment
        </button>
      </div>
    </form>
  );
}
