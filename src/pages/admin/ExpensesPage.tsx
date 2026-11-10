import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { getCurrentAccount } from '../../data/accountStore';
import {
  createExpense,
  listExpenses,
  removeExpense,
  type ApiExpense,
} from '../../services/storeApi';

type Expense = ApiExpense;
type ExpenseInput = Omit<Expense, 'id' | 'recordedBy'>;

type ExpenseView = 'month' | 'all' | 'category' | 'add';

const categories = ['Utilities', 'Supplies', 'Rent', 'Payroll', 'Transport', 'Other'];
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

  async function addExpense(expense: ExpenseInput): Promise<boolean> {
    try {
      const saved = await createExpense(expense);
      setExpenses(await listExpenses().catch(() => [saved, ...expenses]));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The expense was not saved.', 'error');
      return false;
    }
    setView(expense.date.startsWith(thisMonth) ? 'month' : 'all');
    showToast(`${expense.category} expense recorded.`);
    return true;
  }

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
    {
      key: 'add',
      icon: 'credit',
      title: 'Add expense',
      hint: 'Record a new cost',
      tone: 'amber',
      about: 'Record a bill or purchase paid by the pharmacy.',
    },
  ];
  const activeItem = items.find((item) => item.key === view) ?? items[0];

  return (
    <div className="cashier-page">
      <ControlDeck
        id="expenses"
        title="Expenses"
        subtitle="Pick a view. Its list or form opens in the card below."
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
            <ExpenseTable
              expenses={monthExpenses}
              onAdd={() => setView('add')}
              onRemove={onRemove}
            />
          </>
        )}
        {!loading && !loadError && view === 'all' && (
          <ExpenseTable expenses={expenses} onAdd={() => setView('add')} onRemove={onRemove} />
        )}
        {!loading && !loadError && view === 'category' && (
          <CategoryTotals monthExpenses={monthExpenses} expenses={expenses} />
        )}
        {view === 'add' && <ExpenseForm onSave={addExpense} />}
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
  onAdd,
  onRemove,
}: {
  expenses: Expense[];
  onAdd: () => void;
  /** Present only for administrators. */
  onRemove?: (expense: Expense) => void;
}) {
  if (!expenses.length) {
    return (
      <div className="expenses-empty-state">
        <strong>No expenses here yet</strong>
        <span>Record the first bill or purchase to start the list.</span>
        <button type="button" onClick={onAdd}>
          Add expense
        </button>
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
                  <button
                    className="stock-index__link"
                    type="button"
                    onClick={() => onRemove(expense)}
                  >
                    Remove
                  </button>
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

function ExpenseForm({ onSave }: { onSave: (expense: ExpenseInput) => Promise<boolean> }) {
  // Today's date in local time (toISOString would give yesterday before 8 AM in the Philippines).
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Expense['paymentMethod']>('Cash');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const saved = await onSave({
      date,
      category,
      description: description.trim(),
      paymentMethod,
      amount: Number(amount),
    });
    setSaving(false);
    if (saved) {
      setDescription('');
      setAmount('');
    }
  }

  return (
    <form className="stock-index__form" onSubmit={submit}>
      <div className="stock-index__form-grid">
        <label>
          Date
          <input
            name="expense-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Payment method
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as Expense['paymentMethod'])}
          >
            <option>Cash</option>
            <option>GCash</option>
            <option>Bank transfer</option>
            <option>Card</option>
          </select>
        </label>
        <label className="stock-index__field-wide">
          Description
          <input
            name="expense-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            autoComplete="off"
            placeholder="e.g. Electricity bill"
            required
          />
        </label>
        <label>
          Amount
          <input
            name="expense-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </label>
      </div>
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save expense'}
        </button>
      </div>
    </form>
  );
}
