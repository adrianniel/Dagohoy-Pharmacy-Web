import { FormEvent, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';

type Expense = {
  id: string;
  date: string;
  category: string;
  description: string;
  paymentMethod: string;
  amount: number;
};

const EXPENSES_KEY = 'dagohoy_demo_expenses';
const categories = ['Utilities', 'Supplies', 'Rent', 'Payroll', 'Transport', 'Other'];
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));

function readExpenses(): Expense[] {
  try {
    return JSON.parse(localStorage.getItem(EXPENSES_KEY) ?? '[]') as Expense[];
  } catch {
    return [];
  }
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>(readExpenses);
  const [formOpen, setFormOpen] = useState(false);
  const { showToast } = useToast();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.startsWith(thisMonth)),
    [expenses, thisMonth],
  );
  const monthTotal = monthExpenses.reduce((total, expense) => total + expense.amount, 0);

  function addExpense(expense: Omit<Expense, 'id'>) {
    const next = [{ ...expense, id: `EXP-${Date.now()}` }, ...expenses];
    setExpenses(next);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(next));
    setFormOpen(false);
    showToast(`${expense.category} expense recorded in this browser.`);
  }

  return (
    <div className="cashier-page">
      <div className="operations-demo-banner operations-demo-banner--with-action">
        <span>
          Expense entries are saved in this browser only. They do not post to accounting, cash, or
          stock.
        </span>
        <button
          className="cashier-primary-action operations-demo-action"
          type="button"
          onClick={() => setFormOpen(true)}
        >
          Add expense
        </button>
      </div>
      <section className="cashier-summary-grid" aria-label="Expense summary">
        <ExpenseStat
          label="This month"
          value={money(monthTotal)}
          detail={`${monthExpenses.length} entries`}
        />
        <ExpenseStat
          label="All recorded"
          value={money(expenses.reduce((sum, item) => sum + item.amount, 0))}
          detail={`${expenses.length} entries`}
        />
        <ExpenseStat
          label="Largest expense"
          value={expenses.length ? money(Math.max(...expenses.map((item) => item.amount))) : '—'}
          detail={expenses.length ? 'Across all entries' : 'No expense entries yet'}
        />
        <ExpenseStat label="Posting status" value="Local demo" detail="No accounting sync" />
      </section>
      <section className="cashier-panel expenses-panel">
        <div className="cashier-panel__heading">
          <div>
            <h3>Expense history</h3>
            <p>Review operating costs recorded by the owner workspace.</p>
          </div>
          <span>{expenses.length} entries</span>
        </div>
        {expenses.length ? (
          <div
            className="cashier-table-wrap"
            role="region"
            aria-label="Expenses table"
            tabIndex={0}
          >
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Payment</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.date)}</td>
                    <td>
                      <span className="expense-category">{expense.category}</span>
                    </td>
                    <td>{expense.description}</td>
                    <td>{expense.paymentMethod}</td>
                    <td>
                      <strong>{money(expense.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="expenses-empty-state">
            <strong>No expenses recorded</strong>
            <span>Add the first operating expense to begin the local register.</span>
            <button type="button" onClick={() => setFormOpen(true)}>
              Add expense
            </button>
          </div>
        )}
      </section>
      {formOpen && <ExpenseForm onClose={() => setFormOpen(false)} onSave={addExpense} />}
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

function ExpenseForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amount, setAmount] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      date,
      category,
      description: description.trim(),
      paymentMethod,
      amount: Number(amount),
    });
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="pos-payment-modal expense-form"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close expense form"
        >
          ×
        </button>
        <p className="eyebrow">Owner expense record</p>
        <h2>Add expense</h2>
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
          Description
          <input
            name="expense-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            autoComplete="off"
            placeholder="e.g. Electricity bill…"
            required
          />
        </label>
        <label>
          Payment method
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option>Cash</option>
            <option>GCash</option>
            <option>Bank transfer</option>
            <option>Card</option>
          </select>
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
            autoFocus
          />
        </label>
        <button className="pos-checkout-button" type="submit">
          Save local expense
        </button>
      </form>
    </div>
  );
}
