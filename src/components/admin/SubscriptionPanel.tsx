import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../services/apiClient';
import { getBilling, submitBillingPayment, type ApiBilling } from '../../services/storeApi';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';
import { useToast } from '../toast';

/*
 * The owner's monthly subscription: barcode lookup service and system maintenance, one fixed
 * fee due on the 1st. Each GCash payment pays one month (the oldest unpaid one). It opens
 * 3 days before the 1st; 7 days after the 1st an unpaid month pauses the barcode lookup service.
 */

/** Fired after a payment is sent, so the reminder at the top refreshes. */
const BILLING_CHANGED = 'dagohoy-billing-changed';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
const dayName = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' });
/** The last day before the pause: "pay by" this day. */
const lastDay = (pauseDate: string) => {
  const day = new Date(`${pauseDate}T00:00:00`);
  day.setDate(day.getDate() - 1);
  return day.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' });
};

const STATUS: Record<ApiBilling['status'], { label: string; tone: string }> = {
  not_started: { label: 'Not started yet', tone: 'muted' },
  paid: { label: 'Paid', tone: 'ok' },
  pending: { label: 'Waiting for confirmation', tone: 'wait' },
  upcoming: { label: 'Due soon', tone: 'due' },
  due: { label: 'Due now', tone: 'due' },
  overdue: { label: 'Overdue: lookup paused', tone: 'late' },
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
      showToast(`Payment for ${monthName(sent.firstMonth)} sent for checking.`);
      window.dispatchEvent(new Event(BILLING_CHANGED));
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
  const [paying, ...after] = billing.unpaidMonths;
  return (
    <div className="subscription">
      <section className={`subscription__plan is-${status.tone}`}>
        <div>
          <p>Barcode lookup service & system maintenance</p>
          <strong>
            {money(billing.fee)} <small>/ month · due every 1st</small>
          </strong>
          {billing.paidThrough && <span>Paid through {monthName(billing.paidThrough)}.</span>}
        </div>
        <em>{status.label}</em>
      </section>

      {paying && (
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
              Pay now: <b>{money(billing.fee)}</b>
              <small>For {monthName(paying)}</small>
            </p>
            {after.length > 0 && (
              <p className="subscription__more" role="note">
                {after.length + 1} months are unpaid. Pay {money(billing.fee)} once for each month:
                after this one, scan and pay again for {after.map(monthName).join(', ')}.
              </p>
            )}
            <ol>
              <li>Open GCash and scan the QR. The amount is {money(billing.fee)}.</li>
              <li>Send the payment.</li>
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
                <td>{monthName(payment.firstMonth)}</td>
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

/**
 * The reminder at the top of every owner page: 3 days before the 1st, while due (with the last
 * day before the pause), and once the barcode lookup service is paused.
 */
export function SubscriptionNotice() {
  const [billing, setBilling] = useState<ApiBilling | null>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const load = () =>
      getBilling()
        .then(setBilling)
        .catch(() => undefined); // a reminder only: stay quiet if it cannot load
    load();
    window.addEventListener(BILLING_CHANGED, load);
    return () => window.removeEventListener(BILLING_CHANGED, load);
  }, [pathname]);

  if (!billing || !['upcoming', 'due', 'overdue'].includes(billing.status)) return null;
  const [oldest] = billing.unpaidMonths;
  const fee = money(billing.fee);
  const count = billing.unpaidMonths.length;
  const several = count > 1 ? ` ${count} months unpaid: pay ${fee} once for each month.` : '';
  let tone = 'is-soon';
  let text = '';
  if (billing.status === 'upcoming') {
    text = `Reminder: the ${fee} subscription for ${monthName(oldest)} is due on ${dayName(
      billing.dueDate ?? `${oldest}-01`,
    )}. Pay early to keep the barcode lookup service running.`;
  } else if (billing.status === 'due') {
    tone = 'is-due';
    text = `The ${fee} subscription for ${monthName(oldest)} is due. Pay by ${lastDay(
      billing.pauseDate ?? '',
    )}: the barcode lookup service pauses on ${dayName(billing.pauseDate ?? '')}.${several}`;
  } else {
    tone = 'is-late';
    text = `Barcode lookup service is paused: the subscription for ${monthName(
      oldest,
    )} is not paid. New products must be typed in by hand until it is paid.${several}`;
  }
  return (
    <p className={`subscription-notice ${tone}`} role={tone === 'is-late' ? 'alert' : 'status'}>
      <span>{text}</span>
      {!pathname.startsWith('/admin/settings') && (
        <Link to="/admin/settings?tab=subscription">Pay now</Link>
      )}
    </p>
  );
}
