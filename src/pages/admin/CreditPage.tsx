import { FormEvent, useMemo, useState } from 'react';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { useToast } from '../../components/toast';

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

const SALES_KEY = 'dagohoy_demo_sales';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));

function readCreditSales(): CreditSale[] {
  try {
    return (JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as CreditSale[]).filter(
      (sale) => sale.payment === 'Credit' && Number(sale.creditBalance) > 0,
    );
  } catch {
    return [];
  }
}

export function CreditPage() {
  const [credits, setCredits] = useState<CreditSale[]>(readCreditSales);
  const [selectedCredit, setSelectedCredit] = useState<CreditSale | null>(null);
  const { showToast } = useToast();
  const outstanding = useMemo(
    () => credits.reduce((total, credit) => total + Number(credit.creditBalance), 0),
    [credits],
  );

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
    setCredits(
      nextSales.filter((sale) => sale.payment === 'Credit' && Number(sale.creditBalance) > 0),
    );
    setSelectedCredit(null);
    showToast(`Payment of ${money(amount)} recorded for ${receipt}.`);
  }

  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Owner controls · local demo"
        title="Credit Accounts"
        description="Review unpaid credit sales and record payments against customer balances."
      />
      <p className="operations-demo-banner">
        Credit balances are saved in this browser only. They are not connected to live receivables
        or accounting.
      </p>
      <section className="cashier-summary-grid" aria-label="Credit summary">
        <CreditStat
          label="Outstanding balance"
          value={money(outstanding)}
          detail={`${credits.length} open account${credits.length === 1 ? '' : 's'}`}
        />
        <CreditStat label="Credit sales" value={String(credits.length)} detail="Awaiting payment" />
        <CreditStat
          label="Collection status"
          value={credits.length ? 'Open' : 'Clear'}
          detail="Browser-local records"
        />
        <CreditStat label="Payment source" value="POS" detail="Created from credit sale" />
      </section>
      <section className="cashier-panel credit-panel">
        <div className="cashier-panel__heading">
          <div>
            <h3>Open credit balances</h3>
            <p>Collect against a balance only after confirming the customer and amount received.</p>
          </div>
          <span>{credits.length} open</span>
        </div>
        {credits.length ? (
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
                        onClick={() => setSelectedCredit(credit)}
                      >
                        Record payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="expenses-empty-state">
            <strong>No open credit balances</strong>
            <span>Credit sales created in POS will appear here for collection.</span>
          </div>
        )}
      </section>
      {selectedCredit && (
        <CreditPaymentForm
          credit={selectedCredit}
          onClose={() => setSelectedCredit(null)}
          onSave={(amount) => recordPayment(selectedCredit.receipt, amount)}
        />
      )}
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
  credit,
  onClose,
  onSave,
}: {
  credit: CreditSale;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const balance = Number(credit.creditBalance);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(Number(amount));
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="pos-payment-modal credit-payment-form"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close payment form"
        >
          ×
        </button>
        <p className="eyebrow">Credit collection</p>
        <h2>Record payment</h2>
        <div className="pos-payment-total">
          <span>{credit.customer || 'Customer'} balance</span>
          <strong>{money(balance)}</strong>
        </div>
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
        <button
          className="pos-checkout-button"
          type="submit"
          disabled={Number(amount) <= 0 || Number(amount) > balance}
        >
          Save payment
        </button>
      </form>
    </div>
  );
}
