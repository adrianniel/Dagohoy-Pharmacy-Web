import { FormEvent, useEffect, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
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
type DrawerTask = 'status' | 'movements' | 'cash' | 'close';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

/*
 * The Cash drawer page is the record of the open shift: the float, cash sales
 * and non-sale cash movements. The shift is started from the top bar; it can be
 * closed here or from the top bar. Each task opens in the card under the buttons.
 */
export function RegisterPage() {
  const session = getSession();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [active, setActive] = useState<DrawerTask>('status');
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
    setActive('status');
    showToast(
      result
        ? `Shift closed. Expected ${money(result.expected)} · counted ${money(counted)} · variance ${money(result.variance)}.`
        : 'The shift was already closed.',
      'success',
    );
  }

  const tiles: Array<ControlItem<DrawerTask>> = [
    {
      key: 'status',
      icon: 'register',
      title: 'Drawer status',
      hint: session ? 'Register open' : 'Register closed',
      tone: 'forest',
      about: 'The float, cash taken this shift, and how much should be in the drawer now.',
    },
    {
      key: 'movements',
      icon: 'transactions',
      title: 'Cash movements',
      hint: 'Money in or out, not sales',
      tone: 'blue',
      count: events.length,
      about: 'Every cash in, cash out and utang payment recorded this shift.',
    },
    {
      key: 'cash',
      icon: 'cash',
      title: 'Cash in / out',
      hint: session ? 'Record a movement' : 'Needs an open shift',
      tone: 'teal',
      about: 'Cash put into or taken out of the drawer that is not a sale, with the reason.',
    },
    {
      key: 'close',
      icon: 'clock',
      title: 'Close register',
      hint: session ? 'Count the drawer' : 'No shift to close',
      tone: 'rose',
      about: 'Count the cash in the drawer, then close the shift. The handover is saved.',
    },
  ];
  const activeTile = tiles.find((tile) => tile.key === active) ?? tiles[0];

  return (
    <div className="cashier-page">
      <ControlDeck
        id="drawer"
        title="Cash drawer"
        subtitle="Pick a task. It opens in the card below."
        items={tiles}
        active={active}
        onSelect={setActive}
      />

      <ControlPanel
        id="drawer"
        activeKey={active}
        title={activeTile.title}
        about={activeTile.about}
      >
        {active === 'status' && (
          <>
            <div className={`register-state-card${session ? ' is-open' : ''}`}>
              <span className={`register-state-light${session ? ' is-open' : ''}`} />
              <div>
                <strong>{session ? 'Register open' : 'Register closed'}</strong>
                <span>
                  {session
                    ? `Start of shift ${new Date(session.openedAt).toLocaleString('en-PH')} · ${(
                        session.onDutyNames ?? [session.cashierName]
                      ).join(', ')} on duty`
                    : 'Start a shift from the top bar to open the register.'}
                </span>
                {!session && previousShift && (
                  <Link className="register-previous-link" to="/cashier/shift-report">
                    Review the previous shift ({previousShift.cashierName}) before starting
                  </Link>
                )}
              </div>
            </div>
            <div className="cashier-summary-grid register-summary-grid">
              <RegisterStat label="Opening float" value={money(session?.openingFloat ?? 0)} />
              <RegisterStat label="Cash sales" value={money(totals.cashSales)} />
              <RegisterStat
                label="Utang cash"
                value={money(totals.creditCash)}
                detail="Down payments and paid balances"
              />
              <RegisterStat
                label="Paid in / out"
                value={`${money(totals.paidIn)} / ${money(totals.paidOut)}`}
              />
              <RegisterStat label="Expected in drawer" value={money(totals.expected)} />
            </div>
            {session?.floatAdjustment && (
              <p className="register-float-note">
                Float adjusted from {money(session.floatAdjustment.carriedOver)} — reason: “
                {session.floatAdjustment.reason}”
              </p>
            )}
          </>
        )}

        {active === 'movements' &&
          (events.length ? (
            <div
              className="cashier-table-wrap"
              role="region"
              aria-label="Cash movements table"
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
                          event.type === 'Paid out' ? 'movement-negative' : 'movement-positive'
                        }
                      >
                        {event.type === 'Paid out' ? '−' : '+'}
                        {money(event.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="register-empty">No cash movements for this shift yet.</p>
          ))}

        {active === 'cash' &&
          (session ? (
            <CashMovementForm
              onSave={(event) => {
                addCashEvent(event);
                showToast(`${event.type} recorded.`, 'success');
                setActive('movements');
              }}
            />
          ) : (
            <p className="register-empty">
              No shift is open. Use Start shift in the top bar first.
            </p>
          ))}

        {active === 'close' &&
          (session ? (
            <CloseRegisterForm expected={totals.expected} onClose={closeSession} />
          ) : (
            <p className="register-empty">
              No shift is open, so there is nothing to close. Use Start shift in the top bar to open
              the register.
            </p>
          ))}
      </ControlPanel>
    </div>
  );
}

function RegisterStat({
  label,
  value,
  detail = 'This shift',
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

/** Cash put into or taken out of the drawer that is not a sale. */
function CashMovementForm({
  onSave,
}: {
  onSave: (event: {
    id: string;
    type: MovementType;
    amount: number;
    reason: string;
    date: string;
  }) => void;
}) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<MovementType>('Paid out');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than ₱0.00.');
      return;
    }
    if (!reason.trim()) {
      setError('Type the reason for this cash movement.');
      return;
    }
    onSave({
      id: `CASH-${Date.now()}`,
      type,
      amount: value,
      reason: reason.trim(),
      date: new Date().toISOString(),
    });
    setAmount('');
    setReason('');
  }

  return (
    <form className="stock-index__form" onSubmit={submit} noValidate>
      <p className="stock-index__form-title">
        Cash out: money taken from the drawer (e.g. petty cash). Cash in: money added (e.g. more
        change).
      </p>
      <div className="stock-index__form-grid">
        <label>
          Movement
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as MovementType);
              setError('');
            }}
          >
            <option value="Paid out">Cash out (paid out)</option>
            <option value="Paid in">Cash in (paid in)</option>
          </select>
        </label>
        <label>
          Amount
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value.replace(/[^\d.]/g, ''));
              setError('');
            }}
            placeholder="0.00"
          />
        </label>
        <label>
          Reason
          <input
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError('');
            }}
            placeholder="e.g. Petty cash for ice"
          />
        </label>
      </div>
      {error && (
        <p className="stock-index__warn" role="alert">
          {error}
        </p>
      )}
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit">
          Save cash movement
        </button>
      </div>
    </form>
  );
}

/** Count the drawer and close the shift; shows over or short as the cashier types. */
function CloseRegisterForm({
  expected,
  onClose,
}: {
  expected: number;
  onClose: (counted: number) => void;
}) {
  const [counted, setCounted] = useState('');
  const [error, setError] = useState('');
  const value = Number(counted || 0);
  const variance = value - expected;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!counted.trim()) {
      setError('Enter the cash you counted in the drawer.');
      return;
    }
    onClose(value);
  }

  return (
    <form className="stock-index__form" onSubmit={submit} noValidate>
      <div className="stock-index__chips">
        <span>
          Expected in drawer <b>{money(expected)}</b>
        </span>
        {counted.trim() !== '' && (
          <span className={Math.abs(variance) < 0.005 ? undefined : 'is-low'}>
            {Math.abs(variance) < 0.005
              ? 'Drawer is balanced'
              : `${variance > 0 ? 'Over' : 'Short'} by`}{' '}
            {Math.abs(variance) >= 0.005 && <b>{money(Math.abs(variance))}</b>}
          </span>
        )}
      </div>
      <div className="stock-index__form-grid">
        <label>
          Counted cash
          <input
            inputMode="decimal"
            value={counted}
            onChange={(event) => {
              setCounted(event.target.value.replace(/[^\d.]/g, ''));
              setError('');
            }}
            placeholder="0.00"
          />
        </label>
      </div>
      {error && (
        <p className="stock-index__warn" role="alert">
          {error}
        </p>
      )}
      <div className="stock-index__actions">
        <button className="stock-index__action" type="submit">
          Close and reconcile
        </button>
      </div>
    </form>
  );
}
