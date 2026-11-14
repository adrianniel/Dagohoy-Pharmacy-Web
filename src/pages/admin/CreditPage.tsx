import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { addCashEvent, getSession } from '../../data/registerSession';
import { syncSales } from '../../data/serverSync';
import {
  getCustomerHistory,
  payCustomer,
  renameUtangCustomer,
  type ApiCustomerHistory,
} from '../../services/storeApi';

/*
 * Credit accounts (utang). A customer owes as one person, not per sale: the detail shows one
 * list of everything they bought on credit, every payment with its date and time, and the
 * balance. A payment is for the customer; the server applies it to the oldest utang first.
 */

type CreditSale = {
  id?: number;
  receipt: string;
  date: string;
  total: number;
  payment: string;
  customer?: string;
  amountPaid?: number;
  creditBalance?: number;
  status: string;
};

type CreditView = 'customers' | 'collect' | 'paid';

/** One customer with all of their credit sales. */
type Customer = {
  key: string;
  name: string;
  owed: number;
  paid: number;
  lastDate: string;
};

const SALES_KEY = 'dagohoy_demo_sales';
const UNNAMED = 'Unnamed customer';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const customerKey = (name?: string) => (name?.trim() || UNNAMED).toLowerCase();

/** Every credit (utang) sale that was not voided, open or already paid off. */
function readCreditSales(): CreditSale[] {
  try {
    return (JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as CreditSale[]).filter(
      (sale) => sale.payment === 'Credit' && sale.status !== 'Voided',
    );
  } catch {
    return [];
  }
}

/** Groups credit sales by customer name (trimmed, any letter case), biggest balance first. */
function groupCustomers(sales: CreditSale[]): Customer[] {
  const groups = new Map<string, Customer>();
  for (const sale of sales) {
    const key = customerKey(sale.customer);
    const group = groups.get(key) ?? {
      key,
      name: sale.customer?.trim() || UNNAMED,
      owed: 0,
      paid: 0,
      lastDate: sale.date,
    };
    group.owed += Number(sale.creditBalance ?? 0);
    group.paid += Number(sale.amountPaid ?? 0);
    if (Date.parse(sale.date) > Date.parse(group.lastDate)) group.lastDate = sale.date;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
}

export function CreditPage() {
  const [sales, setSales] = useState<CreditSale[]>(readCreditSales);
  const [view, setView] = useState<CreditView>('customers');
  /** The customer opened from the list (or picked to pay); empty shows the whole list. */
  const [selectedKey, setSelectedKey] = useState('');
  const { showToast, showSuccess } = useToast();
  const customers = useMemo(() => groupCustomers(sales), [sales]);
  const owing = customers.filter((customer) => customer.owed > 0);
  const outstanding = owing.reduce((total, customer) => total + customer.owed, 0);
  const paidOff = useMemo(() => sales.filter((sale) => Number(sale.creditBalance) <= 0), [sales]);
  const selected = customers.find((customer) => customer.key === selectedKey);

  function openCustomer(key: string) {
    setSelectedKey(key);
    setView('customers');
  }

  /** Saves a payment for the whole customer. Returns true when saved. */
  async function recordPayment(customer: Customer, amount: number) {
    try {
      await payCustomer(customer.name, amount);
      await syncSales();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The payment was not saved.', 'error');
      return false;
    }
    // The server adds the cash to the open shift's count; this copy shows it on the register.
    const shiftOpen = Boolean(getSession());
    if (shiftOpen) {
      addCashEvent({
        id: `UTANG-${Date.now()}`,
        type: 'Utang payment',
        amount,
        reason: `${customer.name} paid toward utang`,
        date: new Date().toISOString(),
      });
    }
    setSales(readCreditSales());
    openCustomer(customer.key);
    showSuccess({
      title: 'Payment recorded',
      message: (
        <>
          <b>{customer.name}</b> paid <b>{money(amount)}</b>.
        </>
      ),
      notes: [
        shiftOpen
          ? 'Added to the cash drawer.'
          : 'No shift is open, so it is not in a drawer count.',
      ],
    });
    return true;
  }

  /** Renames a customer on every one of their credit sales. Returns true when saved. */
  async function renameCustomer(from: Customer, nextName: string) {
    const name = nextName.trim();
    if (!name) {
      showToast('Enter a name for this customer.', 'error');
      return false;
    }
    if (name === from.name) return true;
    const nextKey = customerKey(name);
    const other = customers.find(
      (customer) => customer.key === nextKey && customer.key !== from.key,
    );
    if (
      other &&
      !window.confirm(
        `${other.name} is already a customer. Their utang and ${from.name}'s will be joined under one name. Continue?`,
      )
    ) {
      return false;
    }
    try {
      await renameUtangCustomer(from.name, name);
      await syncSales();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The new name was not saved.', 'error');
      return false;
    }
    setSales(readCreditSales());
    setSelectedKey(nextKey);
    showToast(other ? `Joined under ${name}.` : `Customer renamed to ${name}.`, 'success');
    return true;
  }

  const items: Array<ControlItem<CreditView>> = [
    {
      key: 'customers',
      icon: 'staff',
      title: 'Customers',
      hint: `${money(outstanding)} owed`,
      tone: 'rose',
      count: owing.length,
      alert: owing.length > 0,
      about: 'Everyone with utang. Tap a name to see what they owe and what they paid.',
    },
    {
      key: 'collect',
      icon: 'cash',
      title: 'Collect payment',
      hint: 'Customer pays utang',
      tone: 'green',
      about: 'Find the customer, type what they pay now, or pay the full balance.',
    },
    {
      key: 'paid',
      icon: 'transactions',
      title: 'Paid off',
      hint: 'Settled balances',
      tone: 'slate',
      count: paidOff.length,
      about: 'Credit sales that are fully paid.',
    },
  ];
  const activeItem = items.find((item) => item.key === view) ?? items[0];

  return (
    <div className="cashier-page">
      <ControlDeck
        id="credits"
        title="Credit accounts"
        subtitle="Pick a view. Its list or form opens in the card below."
        items={items}
        active={view}
        onSelect={(key) => {
          setView(key);
          setSelectedKey('');
        }}
      />
      <ControlPanel
        id="credits"
        activeKey={view}
        title={view === 'customers' && selected ? selected.name : activeItem.title}
        about={
          view === 'customers' && selected
            ? 'Everything bought on credit, every payment, and the balance.'
            : activeItem.about
        }
      >
        {view === 'customers' &&
          (selected ? (
            <CustomerDetail
              key={`${selected.key}-${selected.owed}`}
              customer={selected}
              onBack={() => setSelectedKey('')}
              onCollect={() => setView('collect')}
              onRename={(name) => renameCustomer(selected, name)}
            />
          ) : (
            <CustomerList
              customers={customers}
              outstanding={outstanding}
              onOpen={(customer) => setSelectedKey(customer.key)}
            />
          ))}
        {view === 'collect' &&
          (owing.length ? (
            <CustomerPaymentForm
              customers={owing}
              initialKey={selectedKey}
              onSave={recordPayment}
            />
          ) : (
            <p className="stock-index__empty">Nobody owes anything right now.</p>
          ))}
        {view === 'paid' &&
          (paidOff.length ? (
            <table className="stock-index__table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Record</th>
                  <th>Date</th>
                  <th>Sale total</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {paidOff.map((sale) => (
                  <tr key={sale.receipt}>
                    <td>
                      <strong>{sale.customer || UNNAMED}</strong>
                    </td>
                    <td className="stock-index__mono">{sale.receipt}</td>
                    <td>{formatDate(sale.date)}</td>
                    <td>{money(sale.total)}</td>
                    <td>{money(Number(sale.amountPaid))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="stock-index__empty">No credit sale has been fully paid yet.</p>
          ))}
      </ControlPanel>
    </div>
  );
}

/** First view: one row per customer, biggest balance first. The name opens the customer. */
function CustomerList({
  customers,
  outstanding,
  onOpen,
}: {
  customers: Customer[];
  outstanding: number;
  onOpen: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const owing = customers.filter((customer) => customer.owed > 0);
  const needle = query.trim().toLowerCase();
  const rows = customers.filter(
    (customer) => (showPaid || customer.owed > 0) && customer.name.toLowerCase().includes(needle),
  );

  if (!customers.length) {
    return (
      <div className="expenses-empty-state">
        <strong>No credit customers yet</strong>
        <span>Utang sales made at the Sales Counter appear here, grouped by customer.</span>
      </div>
    );
  }

  return (
    <>
      <section className="cashier-summary-grid" aria-label="Credit summary">
        <CreditStat
          label="Total owed"
          value={money(outstanding)}
          detail={`${owing.length} customer${owing.length === 1 ? '' : 's'} with utang`}
        />
        <CreditStat
          label="Biggest balance"
          value={owing.length ? money(owing[0].owed) : money(0)}
          detail={owing.length ? owing[0].name : 'Nobody owes'}
        />
        <CreditStat
          label="All credit customers"
          value={String(customers.length)}
          detail="Paid and unpaid"
        />
      </section>
      <div className="stock-index__actions">
        <label className="cashier-search-field">
          <CashierIcon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a customer name"
            aria-label="Search a customer name"
          />
        </label>
        <label className="credit-show-paid">
          <input
            type="checkbox"
            checked={showPaid}
            onChange={(event) => setShowPaid(event.target.checked)}
          />{' '}
          Show paid customers
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="register-empty">
          {needle ? `No customer matches “${query}”.` : 'Nobody owes anything right now.'}
        </p>
      ) : (
        <div
          className="cashier-table-wrap"
          role="region"
          aria-label="Credit customers"
          tabIndex={0}
        >
          <table className="cashier-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Balance</th>
                <th>Last utang</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.key}>
                  <td>
                    <button
                      className="credit-name-button"
                      type="button"
                      onClick={() => onOpen(customer)}
                      title={`See ${customer.name}'s utang and payments`}
                    >
                      {customer.name}
                    </button>
                  </td>
                  <td>
                    <strong>{customer.owed > 0 ? money(customer.owed) : 'Paid'}</strong>
                  </td>
                  <td>{formatDate(customer.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** One customer: balance, one list of every item bought on credit, and the payment history. */
function CustomerDetail({
  customer,
  onBack,
  onCollect,
  onRename,
}: {
  customer: Customer;
  onBack: () => void;
  onCollect: () => void;
  onRename: (name: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [history, setHistory] = useState<ApiCustomerHistory | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let current = true;
    getCustomerHistory(customer.name)
      .then((result) => current && setHistory(result))
      .catch(
        (error: unknown) =>
          current &&
          setLoadError(error instanceof Error ? error.message : 'Could not load the utang.'),
      );
    return () => {
      current = false;
    };
  }, [customer.name]);

  return (
    <>
      <div className="stock-index__actions">
        <button className="cashier-view-button" type="button" onClick={onBack}>
          ← All customers
        </button>
        {history && history.balance > 0 && (
          <button className="stock-index__action" type="button" onClick={onCollect}>
            Collect payment
          </button>
        )}
        {!editing && (
          <button
            className="cashier-view-button"
            type="button"
            onClick={() => {
              setName(customer.name);
              setEditing(true);
            }}
          >
            Edit name
          </button>
        )}
      </div>
      {editing && (
        <form
          className="stock-index__form"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (await onRename(name)) setEditing(false);
          }}
        >
          <p className="stock-index__form-title">
            The new name is used on all of this customer's utang.
          </p>
          <div className="stock-index__form-grid">
            <label className="stock-index__field-wide">
              Customer name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                required
              />
            </label>
          </div>
          <div className="stock-index__actions">
            <button className="stock-index__action" type="submit">
              Save name
            </button>
            <button className="cashier-view-button" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {loadError && <ErrorState message={loadError} />}
      {!history && !loadError && <LoadingState label="Loading utang…" />}
      {history && (
        <>
          <section className="cashier-summary-grid" aria-label={`${history.name} summary`}>
            <CreditStat
              label="Balance"
              value={money(history.balance)}
              detail={history.balance > 0 ? 'Still to pay' : 'Fully paid'}
            />
            <CreditStat
              label="Total utang"
              value={money(history.total)}
              detail={`${history.items.filter((item) => item.quantity > 0).length} items`}
            />
            <CreditStat
              label="Paid so far"
              value={money(history.paid)}
              detail={`${history.payments.length} payment${history.payments.length === 1 ? '' : 's'}`}
            />
          </section>

          <h4 className="credit-section-title">Utang items · oldest first</h4>
          <div
            className="cashier-table-wrap"
            role="region"
            aria-label={`${history.name} utang items`}
            tabIndex={0}
          >
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Record</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item, index) => (
                  <tr key={`${item.receipt}-${index}`}>
                    <td>{formatDate(item.date)}</td>
                    <td>{formatTime(item.date)}</td>
                    <td className="cashier-mono">{item.receipt}</td>
                    <td>{item.product}</td>
                    <td>{item.quantity || ''}</td>
                    <td>{item.quantity ? money(item.unitPrice) : ''}</td>
                    <td>{money(item.amount)}</td>
                  </tr>
                ))}
                <tr className="credit-total-row">
                  <td colSpan={6}>
                    <strong>Total utang</strong>
                  </td>
                  <td>
                    <strong>{money(history.total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="credit-section-title">Payments</h4>
          {history.payments.length ? (
            <div
              className="cashier-table-wrap"
              role="region"
              aria-label={`${history.name} payments`}
              tabIndex={0}
            >
              <table className="cashier-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Applied to</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.payments.map((payment) => (
                    <tr key={`${payment.date}-${payment.kind}`}>
                      <td>{formatDate(payment.date)}</td>
                      <td>{formatTime(payment.date)}</td>
                      <td>{payment.kind}</td>
                      <td className="cashier-mono">{payment.records}</td>
                      <td>{money(payment.amount)}</td>
                    </tr>
                  ))}
                  <tr className="credit-total-row">
                    <td colSpan={4}>
                      <strong>Paid so far</strong>
                    </td>
                    <td>
                      <strong>{money(history.paid)}</strong>
                    </td>
                  </tr>
                  <tr className="credit-total-row is-balance">
                    <td colSpan={4}>
                      <strong>Balance</strong>
                    </td>
                    <td>
                      <strong>{money(history.balance)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="register-empty">No payments yet. Balance: {money(history.balance)}.</p>
          )}
        </>
      )}
    </>
  );
}

function CreditStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

/** Find the customer by name, type what they pay now, or pay the whole balance. */
function CustomerPaymentForm({
  customers,
  initialKey,
  onSave,
}: {
  customers: Customer[];
  initialKey: string;
  onSave: (customer: Customer, amount: number) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [key, setKey] = useState(
    customers.some((customer) => customer.key === initialKey) ? initialKey : '',
  );
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const customer = customers.find((item) => item.key === key);
  const needle = query.trim().toLowerCase();
  const matches = customers.filter((item) => item.name.toLowerCase().includes(needle)).slice(0, 8);
  const balance = Math.round((customer?.owed ?? 0) * 100) / 100;
  const value = Number(amount);
  const valid = Boolean(customer) && value > 0 && value <= balance + 0.004;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || !customer || saving) return;
    setSaving(true);
    const saved = await onSave(customer, value);
    setSaving(false);
    if (saved) setAmount('');
  }

  return (
    <form className="stock-index__form" onSubmit={submit}>
      <p className="stock-index__form-title">
        {getSession()
          ? 'Cash received here is added to the open shift, so the drawer count at closing includes it.'
          : 'No shift is open. Start a shift first if this cash goes into the drawer.'}
      </p>
      {customer ? (
        <div className="credit-picked">
          <div>
            <strong>{customer.name}</strong>
            <span>Balance {money(balance)}</span>
          </div>
          <button
            className="cashier-view-button"
            type="button"
            onClick={() => {
              setKey('');
              setAmount('');
            }}
          >
            Change customer
          </button>
        </div>
      ) : (
        <>
          <div className="cashier-search-field credit-find">
            <CashierIcon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type the customer's name"
              aria-label="Find the customer who is paying"
              autoFocus
            />
          </div>
          {matches.length ? (
            <ul className="credit-find__list">
              {matches.map((item) => (
                <li key={item.key}>
                  <button
                    className="credit-name-button"
                    type="button"
                    onClick={() => setKey(item.key)}
                  >
                    {item.name}
                  </button>
                  <span>owes {money(item.owed)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="register-empty">No customer with utang matches “{query}”.</p>
          )}
        </>
      )}
      {customer && (
        <>
          <div className="stock-index__form-grid">
            <label>
              Amount paid now
              <input
                name="credit-payment-amount"
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                required
                autoFocus
              />
            </label>
          </div>
          {value > balance + 0.004 && (
            <p className="stock-index__warn">That is more than the balance of {money(balance)}.</p>
          )}
          <div className="stock-index__actions">
            <button
              className="stock-index__action"
              type="button"
              onClick={() => setAmount(balance.toFixed(2))}
            >
              Pays the full balance ({money(balance)})
            </button>
            <button className="stock-index__action" type="submit" disabled={!valid || saving}>
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
