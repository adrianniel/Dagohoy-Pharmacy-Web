import { FormEvent, useEffect, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/toast';
import {
  addCashEvent,
  endShift,
  getCashEvents,
  getSession,
  getShiftTotals,
  STORE_STATUS_CHANGE_EVENT,
} from '../../data/registerSession';
import { getPreviousShift } from '../../data/shiftHistory';

type MovementType = 'Paid in' | 'Paid out';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

/*
 * The Cash drawer page is the record of the open shift: the float, cash sales
 * and non-sale cash movements. The shift itself is started and ended from the
 * top bar, so this page no longer opens a register of its own.
 */
export function RegisterPage() {
  const session = getSession();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [mode, setMode] = useState<'movement' | 'close' | null>(null);
  const { showToast } = useToast();
  const previousShift = getPreviousShift();
  const events = getCashEvents();
  const totals = getShiftTotals(session);

  useEffect(() => {
    const sync = () => refresh();
    window.addEventListener(STORE_STATUS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STORE_STATUS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function closeSession(counted: number) {
    const result = endShift(counted);
    setMode(null);
    showToast(
      result
        ? `Shift closed. Expected ${money(result.expected)} · counted ${money(counted)} · variance ${money(result.variance)}.`
        : 'The shift was already closed.',
      'success',
    );
  }

  return (
    <div className="cashier-page">
      <div className={`register-state-card${session ? ' is-open' : ''}`}>
        <span className={`register-state-light${session ? ' is-open' : ''}`} />
        <div>
          <strong>{session ? 'Register open' : 'Register closed'}</strong>
          <span>
            {session
              ? `Start of shift ${new Date(session.openedAt).toLocaleString('en-PH')} · ${
                  (session.onDutyNames ?? [session.cashierName]).join(', ')
                } on duty`
              : 'Start a shift from the top bar to open the register.'}
          </span>
          {!session && previousShift && (
            <Link className="register-previous-link" to="/cashier/shift-report">
              Review the previous shift ({previousShift.cashierName}) before starting
            </Link>
          )}
        </div>
        <div className="register-state-actions">
          {session ? (
            <button
              className="cashier-primary-action register-state-action"
              type="button"
              onClick={() => setMode('close')}
            >
              Close register
            </button>
          ) : (
            <span className="cashier-view-button register-state-action is-muted">
              Use Start shift in the top bar
            </span>
          )}
        </div>
      </div>
      <div className="cashier-summary-grid">
        <RegisterStat label="Opening float" value={money(session?.openingFloat ?? 0)} />
        <RegisterStat label="Cash sales" value={money(totals.cashSales)} />
        <RegisterStat
          label="Paid in / out"
          value={`${money(totals.paidIn)} / ${money(totals.paidOut)}`}
        />
        <RegisterStat label="Expected in drawer" value={money(totals.expected)} />
      </div>
      {session?.floatAdjustment && (
        <p className="register-float-note">
          Float adjusted from {money(session.floatAdjustment.carriedOver)} — reason: “{session.floatAdjustment.reason}”
        </p>
      )}
      <div className="cashier-panel register-activity-panel">
        <div className="cashier-panel__heading">
          <div>
            <h3>Cash movements</h3>
            <p>Non-sale cash movements associated with this shift.</p>
          </div>
          <div className="register-actions">
            <button
              type="button"
              className="cashier-view-button"
              disabled={!session}
              onClick={() => setMode('movement')}
            >
              Record cash movement
            </button>
          </div>
        </div>
        {events.length ? (
          <div
            className="cashier-table-wrap"
            role="region"
            aria-label="Register history table"
            tabIndex={0}
          >
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.date).toLocaleString('en-PH')}</td>
                    <td>{event.type}</td>
                    <td>{event.reason}</td>
                    <td
                      className={
                        event.type === 'Paid in' ? 'movement-positive' : 'movement-negative'
                      }
                    >
                      {event.type === 'Paid in' ? '+' : '−'}
                      {money(event.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="register-empty">No cash movements for this shift yet.</p>
        )}
      </div>
      {mode && (
        <RegisterModal
          mode={mode}
          expected={totals.expected}
          onClose={() => setMode(null)}
          onEvent={(event) => {
            addCashEvent(event);
            setMode(null);
            showToast(`${event.type} recorded.`, 'success');
          }}
          onCloseSession={closeSession}
        />
      )}
    </div>
  );
}

function RegisterStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>This shift</span>
    </article>
  );
}

function RegisterModal({
  mode,
  expected,
  onClose,
  onEvent,
  onCloseSession,
}: {
  mode: 'movement' | 'close';
  expected: number;
  onClose: () => void;
  onEvent: (event: {
    id: string;
    type: MovementType;
    amount: number;
    reason: string;
    date: string;
  }) => void;
  onCloseSession: (counted: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<MovementType>('Paid out');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount || 0);
    if (mode === 'close') {
      if (!amount.trim()) {
        setError('Enter the cash you counted in the drawer.');
        return;
      }
      onCloseSession(value);
      return;
    }
    if (!reason.trim()) {
      setError('Type the reason for this cash movement.');
      return;
    }
    onEvent({
      id: `CASH-${Date.now()}`,
      type,
      amount: value,
      reason: reason.trim(),
      date: new Date().toISOString(),
    });
  }

  return (
    <div className="pos-modal-backdrop">
      <form className="pos-payment-modal" onSubmit={submit} noValidate>
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
        <p className="eyebrow">Cash control</p>
        <h2>{mode === 'close' ? 'Close register' : 'Record cash movement'}</h2>
        <p className="inventory-form-note">
          {mode === 'close'
            ? 'Count the drawer, then close the shift. The handover is saved for the next shift.'
            : 'Cash taken out of or put into the drawer that is not a sale.'}
        </p>
        {mode === 'close' && (
          <div className="pos-payment-total">
            <span>Expected cash</span>
            <strong>{money(expected)}</strong>
          </div>
        )}
        {mode === 'movement' && (
          <label>
            Movement type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as MovementType);
                setError('');
              }}
            >
              <option>Paid out</option>
              <option>Paid in</option>
            </select>
          </label>
        )}
        {mode === 'movement' && (
          <label>
            Reason
            <input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError('');
              }}
              placeholder="e.g. Petty cash"
            />
          </label>
        )}
        <label>
          {mode === 'close' ? 'Counted cash' : 'Amount'}
          <input
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value.replace(/[^\d.]/g, ''));
              setError('');
            }}
            placeholder="0.00"
          />
        </label>
        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}
        <button className="pos-checkout-button" type="submit">
          {mode === 'close' ? 'Close and reconcile' : 'Save cash movement'}
        </button>
      </form>
    </div>
  );
}
