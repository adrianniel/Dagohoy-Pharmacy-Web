import { useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { StockWriteOffForm } from '../../components/admin/StockControlCenter';
import {
  initialBatches,
  loadBatches,
  loadMovements,
  StockMovement,
} from '../../data/operationsStore';
type MovementView = 'all' | 'in' | 'out' | 'adjust';

const STOCK_IN_KINDS: StockMovement['kind'][] = ['Received', 'Customer return'];
const STOCK_OUT_KINDS: StockMovement['kind'][] = ['Sale', 'Damaged', 'Return'];

export function OperationsPage() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<MovementView>('all');
  const [movements, setMovements] = useState(loadMovements);

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
          <StockWriteOffForm
            mode="adjustment"
            batches={loadBatches(initialBatches)}
            onSaved={() => {
              setMovements(loadMovements());
              setView('all');
            }}
          />
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
