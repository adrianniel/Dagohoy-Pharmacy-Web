import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../services/apiClient';
import { getBilling, submitBillingPayment, type ApiBilling } from '../../services/storeApi';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';
import { useToast } from '../toast';

/*
 * The owner's monthly subscription to the system (maintenance & support), due on the 1st.
 * Pay by GCash with the QR, type the reference, and it shows "Waiting for confirmation"
 * until the payment is checked.
 */

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

const STATUS: Record<ApiBilling['status'], { label: string; tone: string }> = {
  not_started: { label: 'Not started yet', tone: 'muted' },
  paid: { label: 'Paid', tone: 'ok' },
  pending: { label: 'Waiting for confirmation', tone: 'wait' },
  due: { label: 'Due this month', tone: 'due' },
  overdue: { label: 'Overdue', tone: 'late' },
};
const PAYMENT_STATUS = { pending: 'Waiting', confirmed: 'Confirmed', rejected: 'Not found' };

export function SubscriptionPanel() {
  const [billing, setBilling] = useState<ApiBilling | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    getBilling()
      .then((view) => {
        setBilling(view);
        setLoadError('');
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : 'Could not load.'),
      );
  }, []);
  useEffect(load, [load]);

  async function pay(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const sent = await submitBillingPayment(reference);
      setReference('');
      showToast(`Payment of ${money(sent.amount)} sent for checking.`);
      load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (!billing) return <LoadingState label="Loading the subscription…" />;

  const status = STATUS[billing.status];
  const toPay = billing.unpaidMonths.length * billing.fee;
  return (
    <div className="subscription">
      <section className={`subscription__plan is-${status.tone}`}>
        <div>
          <p>Barcode scanner & maintenance plan</p>
          <strong>
            {money(billing.fee)} <small>/ month · due every 1st</small>
          </strong>
          {billing.paidThrough && <span>Paid through {monthName(billing.paidThrough)}.</span>}
        </div>
        <em>{status.label}</em>
      </section>

      {/* What the monthly fee pays for, biggest first: the barcode scanner lookup leads. */}
      <ul className="subscription__items">
        {[...billing.items]
          .sort((a, b) => b.amount - a.amount)
          .map((item, index) => (
            <li key={item.label} className={index === 0 ? 'is-main' : ''}>
              <span>
                {item.label}
                <small>
                  {index === 0
                    ? 'Fills in the name and details when a new product is scanned.'
                    : 'Updates, fixes, backups and help with the system.'}
                </small>
              </span>
              <b>{money(item.amount)}</b>
            </li>
          ))}
        <li className="subscription__items-total">
          <span>Total per month</span>
          <b>{money(billing.fee)}</b>
        </li>
      </ul>

      {billing.unpaidMonths.length > 0 && (
        <section className="subscription__pay">
          <div className="subscription__qr">
            {billing.qrAvailable ? (
              <img src={`${API_BASE_URL}/billing/qr`} alt="GCash QR code for the subscription" />
            ) : (
              <p>The payment QR is being set up.</p>
            )}
          </div>
          <form onSubmit={(event) => void pay(event)}>
            <p className="subscription__due">
              To pay: <b>{money(toPay)}</b>
              <small>{billing.unpaidMonths.map(monthName).join(', ')}</small>
            </p>
            <ol>
              <li>Open GCash and scan the QR.</li>
              <li>Send exactly {money(toPay)}.</li>
              <li>Type the reference number from the GCash receipt below.</li>
            </ol>
            <label>
              GCash reference number
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                inputMode="numeric"
                placeholder="e.g. 1234 567 890123"
                required
              />
            </label>
            <button
              className="cashier-primary-action"
              type="submit"
              disabled={saving || reference.trim().length < 6}
            >
              {saving ? 'Sending…' : "I've paid"}
            </button>
          </form>
        </section>
      )}

      <h4 className="credit-section-title">Payment history</h4>
      {billing.payments.length === 0 ? (
        <p className="register-empty">No payments yet.</p>
      ) : (
        <table className="stock-index__table">
          <thead>
            <tr>
              <th>Sent</th>
              <th>For</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {billing.payments.map((payment) => (
              <tr key={payment.id}>
                <td>{new Date(payment.submittedAt).toLocaleDateString('en-PH')}</td>
                <td>
                  {monthName(payment.firstMonth)}
                  {payment.months > 1 && ` + ${payment.months - 1} more`}
                </td>
                <td>{payment.reference}</td>
                <td>{money(payment.amount)}</td>
                <td>
                  <span className={`subscription__chip is-${payment.status}`}>
                    {PAYMENT_STATUS[payment.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="register-empty">
        This is a payment record for the system subscription, not a BIR receipt. A payment marked
        "Not found" did not arrive with that reference: check the number and send it again.
      </p>
    </div>
  );
}

/** A short reminder on the Overview when this month or an earlier one is not paid yet. */
export function SubscriptionNotice() {
  const [billing, setBilling] = useState<ApiBilling | null>(null);
  useEffect(() => {
    getBilling()
      .then(setBilling)
      .catch(() => undefined); // a reminder only: stay quiet if it cannot load
  }, []);
  if (!billing || (billing.status !== 'due' && billing.status !== 'overdue')) return null;
  const late = billing.status === 'overdue';
  return (
    <p className={`subscription-notice${late ? ' is-late' : ''}`} role="status">
      {late
        ? `System subscription is overdue: ${billing.unpaidMonths.map(monthName).join(', ')}.`
        : `System subscription for ${monthName(billing.unpaidMonths[0])} is due.`}{' '}
      <Link to="/admin/settings?tab=subscription">Pay now</Link>
    </p>
  );
}
