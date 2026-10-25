import { FormEvent, useMemo, useState } from 'react';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { useToast } from '../../components/toast';
import { notifyStoreStatusChange, REGISTER_SESSION_KEY } from '../../data/registerSession';

const CASH_EVENTS_KEY = 'dagohoy_demo_cash_events';
const SALES_KEY = 'dagohoy_demo_sales';
type Session = { openedAt: string; openingFloat: number } | null;
type CashEvent = {
  id: string;
  type: 'Paid in' | 'Paid out';
  amount: number;
  reason: string;
  date: string;
};
type Sale = { payment: string; total: number; date: string };
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};

export function RegisterPage() {
  const [session, setSession] = useState<Session>(() => readJson(REGISTER_SESSION_KEY, null));
  const [events, setEvents] = useState<CashEvent[]>(() => readJson(CASH_EVENTS_KEY, []));
  const [sales] = useState<Sale[]>(() => readJson(SALES_KEY, []));
  const [mode, setMode] = useState<'open' | 'movement' | 'close' | null>(null);
  const { showToast } = useToast();
  const cashSales = useMemo(
    () =>
      sales
        .filter(
          (sale) =>
            sale.payment === 'Cash' && session && new Date(sale.date) >= new Date(session.openedAt),
        )
        .reduce((sum, sale) => sum + sale.total, 0),
    [sales, session],
  );
  const cashIn = events
    .filter((event) => event.type === 'Paid in')
    .reduce((sum, event) => sum + event.amount, 0);
  const cashOut = events
    .filter((event) => event.type === 'Paid out')
    .reduce((sum, event) => sum + event.amount, 0);
  const expected = (session?.openingFloat ?? 0) + cashSales + cashIn - cashOut;

  function saveEvent(event: CashEvent) {
    const next = [event, ...events];
    setEvents(next);
    localStorage.setItem(CASH_EVENTS_KEY, JSON.stringify(next));
    setMode(null);
    showToast(`${event.type} recorded in the local demo register.`);
  }
  function openSession(float: number) {
    const next = { openingFloat: float, openedAt: new Date().toISOString() };
    setSession(next);
    localStorage.setItem(REGISTER_SESSION_KEY, JSON.stringify(next));
    notifyStoreStatusChange();
    setMode(null);
    showToast('Demo register opened. No live drawer is connected.', 'info');
  }
  function closeSession(counted: number) {
    setSession(null);
    localStorage.removeItem(REGISTER_SESSION_KEY);
    notifyStoreStatusChange();
    setEvents([]);
    localStorage.removeItem(CASH_EVENTS_KEY);
    setMode(null);
    showToast(
      `Demo register closed. Expected ${money(expected)} · counted ${money(counted)} · variance ${money(counted - expected)}.`,
    );
  }

  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Cash management"
        title="Cash drawer"
        description="Open and close a register shift, track paid-in / paid-out cash, and reconcile the drawer."
        action={
          session ? (
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setMode('close')}
            >
              Close register
            </button>
          ) : (
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setMode('open')}
            >
              Open register
            </button>
          )
        }
      />
      <div className="operations-demo-banner">
        Demo register · cash activity and reconciliation are stored in this browser only.
      </div>
      <div className="register-state-card">
        <span className={`register-state-light${session ? ' is-open' : ''}`} />
        <div>
          <strong>{session ? 'Register open' : 'Register closed'}</strong>
          <span>
            {session
              ? `Opened ${new Date(session.openedAt).toLocaleString('en-PH')}`
              : 'Open the register to begin a shift.'}
          </span>
        </div>
        {session && <span className="register-demo-label">LOCAL DEMO</span>}
      </div>
      <div className="cashier-summary-grid">
        <RegisterStat label="Opening float" value={money(session?.openingFloat ?? 0)} />
        <RegisterStat label="Cash sales" value={money(cashSales)} />
        <RegisterStat label="Paid in / out" value={`${money(cashIn)} / ${money(cashOut)}`} />
        <RegisterStat label="Expected in drawer" value={money(expected)} />
      </div>
      <div className="cashier-panel register-activity-panel">
        <div className="cashier-panel__heading">
          <div>
            <h3>Cash movements</h3>
            <p>Non-sale cash movements associated with this register session.</p>
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
          <div className="cashier-table-wrap">
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
          <p className="register-empty">No cash movements for this demo session yet.</p>
        )}
      </div>
      {mode && (
        <RegisterModal
          mode={mode}
          expected={expected}
          onClose={() => setMode(null)}
          onOpen={openSession}
          onEvent={saveEvent}
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
      <span>Demo register totals</span>
    </article>
  );
}

function RegisterModal({
  mode,
  expected,
  onClose,
  onOpen,
  onEvent,
  onCloseSession,
}: {
  mode: 'open' | 'movement' | 'close';
  expected: number;
  onClose: () => void;
  onOpen: (float: number) => void;
  onEvent: (event: CashEvent) => void;
  onCloseSession: (counted: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'Paid in' | 'Paid out'>('Paid out');
  const [reason, setReason] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (mode === 'open') onOpen(value);
    else if (mode === 'close') onCloseSession(value);
    else
      onEvent({
        id: `CASH-${Date.now()}`,
        type,
        amount: value,
        reason,
        date: new Date().toISOString(),
      });
  }
  const title =
    mode === 'open'
      ? 'Open register'
      : mode === 'close'
        ? 'Close register & reconcile'
        : 'Record cash movement';
  return (
    <div className="pos-modal-backdrop">
      <form className="pos-payment-modal" onSubmit={submit}>
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
        <p className="eyebrow">Cash control · demo</p>
        <h2>{title}</h2>
        {mode === 'close' && (
          <div className="pos-payment-total">
            <span>Expected cash</span>
            <strong>{money(expected)}</strong>
          </div>
        )}
        {mode === 'movement' && (
          <label>
            Movement type
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              <option>Paid out</option>
              <option>Paid in</option>
            </select>
          </label>
        )}
        {mode === 'movement' && (
          <label>
            Reason
            <input
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Petty cash"
            />
          </label>
        )}
        <label>
          {mode === 'open' ? 'Opening float' : mode === 'close' ? 'Counted cash' : 'Amount'}
          <input
            type="number"
            min="0"
            step="0.01"
            required
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <button className="pos-checkout-button" type="submit">
          {mode === 'open'
            ? 'Open demo register'
            : mode === 'close'
              ? 'Close and reconcile'
              : 'Save cash movement'}
        </button>
      </form>
    </div>
  );
}
