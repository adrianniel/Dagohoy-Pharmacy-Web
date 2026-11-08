import { FormEvent, useMemo, useState } from 'react';
import { useToast } from '../../components/toast';
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
};

type CreditView = 'open' | 'collect' | 'paid';

const SALES_KEY = 'dagohoy_demo_sales';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));

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

export function CreditPage() {
  const [sales, setSales] = useState<CreditSale[]>(readCreditSales);
  const [view, setView] = useState<CreditView>('open');
  const [collectReceipt, setCollectReceipt] = useState('');
  const { showToast } = useToast();
  const credits = useMemo(() => sales.filter((sale) => Number(sale.creditBalance) > 0), [sales]);
  const paidOff = useMemo(() => sales.filter((sale) => Number(sale.creditBalance) <= 0), [sales]);
  const outstanding = credits.reduce((total, credit) => total + Number(credit.creditBalance), 0);

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
    if (shiftOpen) {
      const customer = allSales.find((sale) => sale.receipt === receipt)?.customer;
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
    setView('open');
    showToast(
      shiftOpen
        ? `Payment of ${money(amount)} recorded for ${receipt} and added to the cash drawer.`
        : `Payment of ${money(amount)} recorded for ${receipt}. No shift is open, so it is not in a drawer count.`,
    );
  }

  const items: Array<ControlItem<CreditView>> = [
    {
      key: 'open',
      icon: 'credit',
      title: 'Open balances',
      hint: money(outstanding),
      tone: 'rose',
      count: credits.length,
      alert: credits.length > 0,
      about: 'Customers who still owe on a credit sale. Saved in this browser only.',
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
        onSelect={setView}
      />
      <ControlPanel id="credits" activeKey={view} title={activeItem.title} about={activeItem.about}>
        {view === 'open' &&
          (credits.length ? (
            <>
              <section className="cashier-summary-grid" aria-label="Credit summary">
                <CreditStat
                  label="Outstanding balance"
                  value={money(outstanding)}
                  detail={`${credits.length} open account${credits.length === 1 ? '' : 's'}`}
                />
                <CreditStat
                  label="Largest balance"
                  value={money(Math.max(...credits.map((credit) => Number(credit.creditBalance))))}
                  detail="Single customer"
                />
                <CreditStat
                  label="Paid off"
                  value={String(paidOff.length)}
                  detail="Settled credit sales"
                />
              </section>
              <div
                className="cashier-table-wrap"
                role="region"
                aria-label="Credit accounts table"
                tabIndex={0}
              >
                <table className="cashier-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Receipt</th>
                      <th>Date</th>
                      <th>Sale total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {credits.map((credit) => (
                      <tr key={credit.receipt}>
                        <td>
                          <strong>{credit.customer || 'Unnamed customer'}</strong>
                        </td>
                        <td className="cashier-mono">{credit.receipt}</td>
                        <td>{formatDate(credit.date)}</td>
                        <td>{money(credit.total)}</td>
                        <td>{money(Number(credit.amountPaid))}</td>
                        <td>
                          <strong>{money(Number(credit.creditBalance))}</strong>
                        </td>
                        <td>
                          <button
                            className="credit-payment-button"
                            type="button"
                            onClick={() => openCollect(credit.receipt)}
                          >
                            Record payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="expenses-empty-state">
              <strong>No open credit balances</strong>
              <span>Credit sales made in the POS appear here until they are paid.</span>
            </div>
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
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Sale total</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {paidOff.map((sale) => (
                  <tr key={sale.receipt}>
                    <td>
                      <strong>{sale.customer || 'Unnamed customer'}</strong>
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
