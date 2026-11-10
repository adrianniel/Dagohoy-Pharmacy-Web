import { FormEvent, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { addCashEvent, getSession } from '../../data/registerSession';

type CreditSale = {
  receipt: string;
  date: string;
  total: number;
  payment: string;
  customer?: string;
  amountPaid?: number;
  creditBalance?: number;
  status: string;
  lines?: Array<{ product: string; barcode?: string; quantity: number; unitPrice: number }>;
};

type CreditView = 'customers' | 'collect' | 'paid';

/** One customer with all of their credit sales. */
type Customer = {
  key: string;
  name: string;
  sales: CreditSale[];
  owed: number;
  paid: number;
  openReceipts: number;
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

/** Groups credit sales by customer name (trimmed, any letter case). */
function groupCustomers(sales: CreditSale[]): Customer[] {
  const groups = new Map<string, Customer>();
  for (const sale of sales) {
    const key = customerKey(sale.customer);
    const group =
      groups.get(key) ??
      ({
        key,
        name: sale.customer?.trim() || UNNAMED,
        sales: [],
        owed: 0,
        paid: 0,
        openReceipts: 0,
        lastDate: sale.date,
      } satisfies Customer);
    group.sales.push(sale);
    group.owed += Number(sale.creditBalance ?? 0);
    group.paid += Number(sale.amountPaid ?? 0);
    if (Number(sale.creditBalance ?? 0) > 0) group.openReceipts += 1;
    if (Date.parse(sale.date) > Date.parse(group.lastDate)) group.lastDate = sale.date;
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sales.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
  return [...groups.values()].sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
}

const itemsText = (sale: CreditSale) =>
  sale.lines?.length
    ? sale.lines.map((line) => `${line.product} × ${line.quantity}`).join(', ')
    : 'No item details';

export function CreditPage() {
  const [sales, setSales] = useState<CreditSale[]>(readCreditSales);
  const [view, setView] = useState<CreditView>('customers');
  const [collectReceipt, setCollectReceipt] = useState('');
  /** The customer opened from the list; empty shows the whole list. */
  const [selectedKey, setSelectedKey] = useState('');
  const { showToast } = useToast();
  const credits = useMemo(() => sales.filter((sale) => Number(sale.creditBalance) > 0), [sales]);
  const paidOff = useMemo(() => sales.filter((sale) => Number(sale.creditBalance) <= 0), [sales]);
  const customers = useMemo(() => groupCustomers(sales), [sales]);
  const owing = customers.filter((customer) => customer.owed > 0);
  const outstanding = credits.reduce((total, credit) => total + Number(credit.creditBalance), 0);
  const selected = customers.find((customer) => customer.key === selectedKey);

  function openCollect(receipt: string) {
    setCollectReceipt(receipt);
    setView('collect');
  }

  function recordPayment(receipt: string, amount: number) {
    const allSales = JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as CreditSale[];
    const nextSales = allSales.map((sale) => {
      if (sale.receipt !== receipt) return sale;
      const remaining = Math.max(0, Number(sale.creditBalance) - amount);
      return {
        ...sale,
        amountPaid: Number(sale.amountPaid) + amount,
        creditBalance: remaining,
        status: remaining === 0 ? 'Completed' : 'Credit',
      };
    });
    localStorage.setItem(SALES_KEY, JSON.stringify(nextSales));
    // The cash goes into the drawer, so the open shift has to expect it at closing.
    const shiftOpen = Boolean(getSession());
    const customer = allSales.find((sale) => sale.receipt === receipt)?.customer;
    if (shiftOpen) {
      addCashEvent({
        id: `UTANG-${Date.now()}`,
        type: 'Utang payment',
        amount,
        reason: `${customer || 'Customer'} paid toward ${receipt}`,
        date: new Date().toISOString(),
      });
    }
    setSales(readCreditSales());
    setCollectReceipt('');
    // Go back to the customer who paid, so the new balance is right there.
    setSelectedKey(customerKey(customer));
    setView('customers');
    showToast(
      shiftOpen
        ? `Payment of ${money(amount)} recorded for ${receipt} and added to the cash drawer.`
        : `Payment of ${money(amount)} recorded for ${receipt}. No shift is open, so it is not in a drawer count.`,
    );
  }

  /** Renames a customer on every one of their credit sales. Returns true when saved. */
  function renameCustomer(from: Customer, nextName: string) {
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
        `${other.name} is already a customer. Their credit sales and ${from.name}'s will be joined under one name. Continue?`,
      )
    ) {
      return false;
    }
    const allSales = JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as CreditSale[];
    localStorage.setItem(
      SALES_KEY,
      JSON.stringify(
        allSales.map((sale) =>
          sale.payment === 'Credit' && customerKey(sale.customer) === from.key
            ? { ...sale, customer: name }
            : sale,
        ),
      ),
    );
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
      about: 'Everyone with utang. Open a name to see their purchases.',
    },
    {
      key: 'collect',
      icon: 'cash',
      title: 'Collect payment',
      hint: 'Customer pays utang',
      tone: 'green',
      about: 'Record money a customer pays toward their balance.',
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
          if (key === 'customers') setSelectedKey('');
        }}
      />
      <ControlPanel
        id="credits"
        activeKey={view}
        title={view === 'customers' && selected ? selected.name : activeItem.title}
        about={
          view === 'customers' && selected
            ? 'Every credit purchase of this customer, newest first.'
            : activeItem.about
        }
      >
        {view === 'customers' &&
          (selected ? (
            <CustomerDetail
              key={selected.key}
              customer={selected}
              onBack={() => setSelectedKey('')}
              onCollect={openCollect}
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
          (credits.length ? (
            <CreditPaymentForm
              key={collectReceipt}
              credits={credits}
              initialReceipt={collectReceipt}
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

/** First view: one row per customer, biggest balance first. */
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
        <span>Credit sales made at the Sales Counter appear here, grouped by customer.</span>
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
                <th>Unpaid sales</th>
                <th>Total owed</th>
                <th>Last purchase</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.key}>
                  <td>
                    <strong>{customer.name}</strong>
                  </td>
                  <td>{customer.openReceipts}</td>
                  <td>
                    <strong>{customer.owed > 0 ? money(customer.owed) : 'Paid'}</strong>
                  </td>
                  <td>{formatDate(customer.lastDate)}</td>
                  <td>
                    <button
                      className="cashier-view-button"
                      type="button"
                      onClick={() => onOpen(customer)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** One customer: totals, edit name, and every credit purchase with its items. */
function CustomerDetail({
  customer,
  onBack,
  onCollect,
  onRename,
}: {
  customer: Customer;
  onBack: () => void;
  onCollect: (receipt: string) => void;
  onRename: (name: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);

  return (
    <>
      <div className="stock-index__actions">
        <button className="cashier-view-button" type="button" onClick={onBack}>
          ← All customers
        </button>
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
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (onRename(name)) setEditing(false);
          }}
        >
          <p className="stock-index__form-title">
            The new name is used on all of this customer's credit sales.
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
      <section className="cashier-summary-grid" aria-label={`${customer.name} summary`}>
        <CreditStat
          label="Still owes"
          value={money(customer.owed)}
          detail={`${customer.openReceipts} unpaid sale${customer.openReceipts === 1 ? '' : 's'}`}
        />
        <CreditStat label="Paid so far" value={money(customer.paid)} detail="All credit sales" />
        <CreditStat
          label="Credit purchases"
          value={String(customer.sales.length)}
          detail={`Last on ${formatDate(customer.lastDate)}`}
        />
      </section>
      <div
        className="cashier-table-wrap"
        role="region"
        aria-label={`${customer.name} credit purchases`}
        tabIndex={0}
      >
        <table className="cashier-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Record</th>
              <th>Items</th>
              <th>Sale total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {customer.sales.map((sale) => {
              const balance = Number(sale.creditBalance ?? 0);
              return (
                <tr key={sale.receipt}>
                  <td>{formatDate(sale.date)}</td>
                  <td>{formatTime(sale.date)}</td>
                  <td className="cashier-mono">{sale.receipt}</td>
                  <td>{itemsText(sale)}</td>
                  <td>{money(sale.total)}</td>
                  <td>{money(Number(sale.amountPaid ?? 0))}</td>
                  <td>
                    <strong>{money(balance)}</strong>
                  </td>
                  <td>{balance > 0 ? 'Open' : 'Paid'}</td>
                  <td>
                    {balance > 0 && (
                      <button
                        className="cashier-view-button"
                        type="button"
                        onClick={() => onCollect(sale.receipt)}
                      >
                        Collect
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

function CreditPaymentForm({
  credits,
  initialReceipt,
  onSave,
}: {
  credits: CreditSale[];
  initialReceipt: string;
  onSave: (receipt: string, amount: number) => void;
}) {
  const [receipt, setReceipt] = useState(
    credits.some((credit) => credit.receipt === initialReceipt)
      ? initialReceipt
      : (credits[0]?.receipt ?? ''),
  );
  const [amount, setAmount] = useState('');
  const credit = credits.find((item) => item.receipt === receipt);
  const balance = Number(credit?.creditBalance ?? 0);
  const value = Number(amount);
  const valid = Boolean(credit) && value > 0 && value <= balance;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid) onSave(receipt, value);
  }

  return (
    <form className="stock-index__form" onSubmit={submit}>
      <p className="stock-index__form-title">
        {getSession()
          ? 'Cash received here is added to the open shift, so the drawer count at closing includes it.'
          : 'No shift is open. Start a shift first if this cash goes into the drawer.'}
      </p>
      <div className="stock-index__form-grid">
        <label className="stock-index__field-wide">
          Customer balance
          <select
            value={receipt}
            onChange={(event) => {
              setReceipt(event.target.value);
              setAmount('');
            }}
          >
            {credits.map((item) => (
              <option value={item.receipt} key={item.receipt}>
                {item.customer || 'Unnamed customer'} · {item.receipt} · owes{' '}
                {money(Number(item.creditBalance))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount received
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
      {value > balance && (
        <p className="stock-index__warn">That is more than the balance of {money(balance)}.</p>
      )}
      <div className="stock-index__actions">
        <button
          className="stock-index__action"
          type="button"
          onClick={() => setAmount(balance.toFixed(2))}
          disabled={!credit}
        >
          Pays it all ({money(balance)})
        </button>
        <button className="stock-index__action" type="submit" disabled={!valid}>
          Save payment
        </button>
      </div>
    </form>
  );
}
