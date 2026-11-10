import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/toast';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { getCurrentAccount } from '../../data/accountStore';
import { listExpenses, removeExpense, type ApiExpense } from '../../services/storeApi';

/*
 * Expenses are recorded at the Cash drawer as cash out (one entry: it lowers the drawer and
 * lands here with its category). This page only shows and totals them.
 */

type Expense = ApiExpense;

type ExpenseView = 'month' | 'all' | 'category';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
const sum = (list: Expense[]) => list.reduce((total, expense) => total + expense.amount, 0);

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ExpenseView>('month');
  const { showToast } = useToast();
  // Only the owner and administrators remove an entry; the cashier can record one.
  const canRemove = getCurrentAccount()?.role === 'ADMIN';
  // Local month (toISOString would still say last month on the 1st before 8 AM in the Philippines).
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);

  useEffect(() => {
    listExpenses()
      .then(setExpenses)
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : 'Could not load the expenses.'),
      )
      .finally(() => setLoading(false));
  }, []);
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(
    new Date(),
  );
  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.startsWith(thisMonth)),
    [expenses, thisMonth],
  );
  const monthTotal = sum(monthExpenses);
  const allTotal = sum(expenses);

  async function deleteExpense(expense: Expense) {
    if (
      !window.confirm(
        `Remove "${expense.description}" (${money(expense.amount)})? Use this only for an entry made by mistake.`,
      )
    ) {
      return;
    }
    try {
      await removeExpense(expense.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The expense was not removed.', 'error');
      return;
    }
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    showToast('Expense removed.');
  }

  const onRemove = canRemove ? deleteExpense : undefined;

  const items: Array<ControlItem<ExpenseView>> = [
    {
      key: 'month',
      icon: 'calendar',
      title: 'This month',
      hint: money(monthTotal),
      tone: 'forest',
      count: monthExpenses.length,
      about: `Expenses dated in ${monthLabel}.`,
    },
    {
      key: 'all',
      icon: 'expenses',
      title: 'All expenses',
      hint: money(allTotal),
      tone: 'slate',
      count: expenses.length,
      about: 'Every expense recorded, newest first.',
    },
    {
      key: 'category',
      icon: 'reports',
      title: 'By category',
      hint: 'Where the money goes',
      tone: 'teal',
      about: `Totals per category, for ${monthLabel} and for all time.`,
    },
  ];
  const activeItem = items.find((item) => item.key === view) ?? items[0];

  return (
    <div className="cashier-page">
      <ControlDeck
        id="expenses"
        title="Expenses"
        subtitle="Money taken out of the cash drawer, by month and by what it was for."
        items={items}
        active={view}
        onSelect={setView}
      />
      <ControlPanel
        id="expenses"
        activeKey={view}
        title={activeItem.title}
        about={activeItem.about}
      >
        {loading && <LoadingState label="Loading expenses…" />}
        {loadError && <ErrorState message={loadError} />}
        {!loading && !loadError && view === 'month' && (
          <>
            <section className="cashier-summary-grid" aria-label="Expense summary">
              <ExpenseStat
                label="This month"
                value={money(monthTotal)}
                detail={`${monthExpenses.length} entr${monthExpenses.length === 1 ? 'y' : 'ies'}`}
              />
              <ExpenseStat
                label="Largest this month"
                value={
                  monthExpenses.length
                    ? money(Math.max(...monthExpenses.map((item) => item.amount)))
                    : '—'
                }
                detail={monthExpenses.length ? 'Single entry' : 'No entries yet'}
              />
              <ExpenseStat
                label="All recorded"
                value={money(allTotal)}
                detail={`${expenses.length} entr${expenses.length === 1 ? 'y' : 'ies'}`}
              />
            </section>
            <ExpenseTable expenses={monthExpenses} onRemove={onRemove} />
          </>
        )}
        {!loading && !loadError && view === 'all' && (
          <ExpenseTable expenses={expenses} onRemove={onRemove} />
        )}
        {!loading && !loadError && view === 'category' && (
          <CategoryTotals monthExpenses={monthExpenses} expenses={expenses} />
        )}
      </ControlPanel>
    </div>
  );
}

function ExpenseStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function ExpenseTable({
  expenses,
  onRemove,
}: {
  expenses: Expense[];
  /** Present only for administrators. */
  onRemove?: (expense: Expense) => void;
}) {
  if (!expenses.length) {
    return (
      <div className="expenses-empty-state">
        <strong>No expenses here yet</strong>
        <span>Record one at the Cash drawer: Cash in / out → Cash out, with what it was for.</span>
        <Link to="/cashier/register">Open Cash drawer</Link>
      </div>
    );
  }
  return (
    <div className="cashier-table-wrap" role="region" aria-label="Expenses table" tabIndex={0}>
      <table className="cashier-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Payment</th>
            <th>Amount</th>
            {onRemove && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>{formatDate(expense.date)}</td>
              <td>
                <span className="expense-category">{expense.category}</span>
              </td>
              <td>
                {expense.description}
                {expense.recordedBy && <small> · {expense.recordedBy}</small>}
              </td>
              <td>{expense.paymentMethod}</td>
              <td>
                <strong>{money(expense.amount)}</strong>
              </td>
              {onRemove && (
                <td>
                  {expense.fromDrawer ? (
                    <small title="Cash out of the drawer stays in the shift count. Put the money back with a cash in.">
                      From drawer
                    </small>
                  ) : (
                    <button
                      className="stock-index__link"
                      type="button"
                      onClick={() => onRemove(expense)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTotals({
  monthExpenses,
  expenses,
}: {
  monthExpenses: Expense[];
  expenses: Expense[];
}) {
  const categories = [...new Set(expenses.map((expense) => expense.category))];
  const rows = categories
    .map((category) => ({
      category,
      month: sum(monthExpenses.filter((expense) => expense.category === category)),
      all: sum(expenses.filter((expense) => expense.category === category)),
      count: expenses.filter((expense) => expense.category === category).length,
    }))
    .sort((a, b) => b.month - a.month || b.all - a.all);
  if (!expenses.length) {
    return <p className="stock-index__empty">No expenses recorded yet.</p>;
  }
  return (
    <table className="stock-index__table">
      <thead>
        <tr>
          <th>Category</th>
          <th>This month</th>
          <th>All time</th>
          <th>Entries</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.category}>
            <td>
              <span className="expense-category">{row.category}</span>
            </td>
            <td>
              <strong>{money(row.month)}</strong>
            </td>
            <td>{money(row.all)}</td>
            <td>{row.count}</td>
          </tr>
        ))}
        <tr>
          <td>
            <strong>Total</strong>
          </td>
          <td>
            <strong>{money(sum(monthExpenses))}</strong>
          </td>
          <td>
            <strong>{money(sum(expenses))}</strong>
          </td>
          <td>{expenses.length}</td>
        </tr>
      </tbody>
    </table>
  );
}
