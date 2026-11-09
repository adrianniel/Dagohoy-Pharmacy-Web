import { FormEvent, useEffect, useMemo, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  endShift,
  getCarriedOverFloat,
  getSession,
  getShiftTotals,
  startShift,
  STORE_STATUS_CHANGE_EVENT,
} from '../../data/registerSession';
import { getActiveRoster, loadRoster } from '../../data/staffRoster';
import type { ShiftRecord } from '../../data/shiftHistory';
import { ShiftReportModal } from './ShiftReport';
import { useToast } from '../toast';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

/*
 * The top bar has a blur effect, which traps fixed popups inside its own box.
 * Rendering the popups into the workspace shell keeps them centered on the
 * screen, styled by the same theme, exactly like the payment form.
 */
function getModalHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.cashier-shell') ?? document.body;
}

/**
 * The Start shift / End shift pair in the cashier top bar.
 * Starting a shift picks the staff on duty from the roster and locks in the
 * cash float; ending it counts the drawer and files the handover.
 */
export function ShiftControls() {
  const session = getSession();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [mode, setMode] = useState<'start' | 'end' | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const sync = () => refresh();
    window.addEventListener(STORE_STATUS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STORE_STATUS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Both buttons always show. The one that does not fit right now stays visible but
  // faded, and clicking it says why instead of doing nothing.
  const canStart = !session;
  const canEnd = Boolean(session);
  const startHint = canStart
    ? 'Pick the staff on duty and open the drawer.'
    : 'A shift is already running. Close it first before starting a new one.';
  const endHint = canEnd
    ? 'Count the drawer and hand the shift over.'
    : 'No shift is running. Start a shift first.';

  return (
    <>
      <div className="cashier-shift-actions">
        <button
          className={`cashier-shift-action${canStart ? '' : ' is-unavailable'}`}
          type="button"
          aria-disabled={!canStart}
          title={startHint}
          onClick={() => (canStart ? setMode('start') : showToast(startHint, 'info'))}
        >
          Start shift
        </button>
        <button
          className={`cashier-shift-action is-end${canEnd ? '' : ' is-unavailable'}`}
          type="button"
          aria-disabled={!canEnd}
          title={endHint}
          onClick={() => (canEnd ? setMode('end') : showToast(endHint, 'info'))}
        >
          Close shift
        </button>
      </div>
      {mode === 'start' && <StartShiftModal onClose={() => setMode(null)} />}
      {mode === 'end' && <EndShiftModal onClose={() => setMode(null)} />}
    </>
  );
}

export function StartShiftModal({ onClose }: { onClose: () => void }) {
  const roster = useMemo(() => loadRoster(), []);
  const active = useMemo(() => getActiveRoster(), []);
  const carriedOver = useMemo(() => getCarriedOverFloat(), []);
  /** The one person running the system: shown in the top bar, the landing page and receipts. */
  const [cashier, setCashier] = useState('');
  /** Others working the same shift, kept for the duty report only. */
  const [others, setOthers] = useState<string[]>([]);
  const [floatInput, setFloatInput] = useState(String(carriedOver));
  const [adjusting, setAdjusting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const adjusted = Math.abs(Number(floatInput || 0) - carriedOver) >= 0.005;

  function pickCashier(name: string) {
    setCashier(name);
    // The cashier cannot also be one of the "other staff".
    setOthers((current) => current.filter((item) => item !== name));
    setError('');
  }

  function toggleOther(name: string) {
    setOthers((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cashier) {
      setError('Step 1: tap the name of the cashier.');
      return;
    }
    if (adjusted && !reason.trim()) {
      setError('Step 3: type why the cash in the drawer is different.');
      return;
    }
    try {
      const started = startShift({
        onDutyNames: [cashier, ...others],
        openingFloat: Number(floatInput || 0),
        adjustmentReason: adjusted ? reason : undefined,
      });
      showToast(`Shift started · Cashier: ${started.cashierName}`, 'success');
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the shift.');
    }
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  const hasRoster = roster.length > 0 && active.length > 0;
  const cashStep = active.length > 1 ? 3 : 2;
  const startingCash = Number(floatInput || 0);
  const cashDone = !adjusted || reason.trim().length > 0;

  return createPortal(
    <div className="pos-modal-backdrop">
      <form
        className="pos-payment-modal cashier-shift-modal start-shift"
        onSubmit={submit}
        noValidate
        aria-labelledby="start-shift-title"
      >
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <header className="start-shift__head">
          <h2 id="start-shift-title">Start shift</h2>
          <p>
            Answer the steps below, then press <strong>Start shift</strong> at the bottom.
          </p>
        </header>

        {!hasRoster ? (
          <p className="cashier-shift-empty">
            No staff names yet. Ask the owner to add names in Staff → Staff roster.
          </p>
        ) : (
          <>
            <section className={`start-shift__step${cashier ? ' is-done' : ''}`}>
              <h3>
                <span className="start-shift__num" aria-hidden="true">
                  {cashier ? '✓' : '1'}
                </span>
                Who is the cashier?
              </h3>
              <p className="start-shift__hint">
                Tap one name. It shows on the screen and on every receipt.
              </p>
              <div className="start-shift__people" role="radiogroup" aria-label="Cashier">
                {active.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    role="radio"
                    aria-checked={cashier === staff.name}
                    className={`start-shift__person${cashier === staff.name ? ' is-picked' : ''}`}
                    onClick={() => pickCashier(staff.name)}
                  >
                    <span className="start-shift__initials" aria-hidden="true">
                      {cashier === staff.name ? '✓' : initials(staff.name)}
                    </span>
                    {staff.name}
                  </button>
                ))}
              </div>
            </section>

            {active.length > 1 && (
              <section className={`start-shift__step${others.length ? ' is-done' : ''}`}>
                <h3>
                  <span className="start-shift__num" aria-hidden="true">
                    {others.length ? '✓' : '2'}
                  </span>
                  Who else is working? <em>(optional)</em>
                </h3>
                <p className="start-shift__hint">
                  Tap to add. Tap again to remove. Skip this if the cashier is alone.
                </p>
                <div className="start-shift__others">
                  {active
                    .filter((staff) => staff.name !== cashier)
                    .map((staff) => (
                      <button
                        key={staff.id}
                        type="button"
                        aria-pressed={others.includes(staff.name)}
                        className={`start-shift__chip${
                          others.includes(staff.name) ? ' is-picked' : ''
                        }`}
                        onClick={() => toggleOther(staff.name)}
                      >
                        <span aria-hidden="true">{others.includes(staff.name) ? '✓' : '+'}</span>
                        {staff.name}
                      </button>
                    ))}
                </div>
              </section>
            )}

            <section className={`start-shift__step${cashDone && cashier ? ' is-done' : ''}`}>
              <h3>
                <span className="start-shift__num" aria-hidden="true">
                  {cashDone && cashier ? '✓' : cashStep}
                </span>
                Check the cash in the drawer
              </h3>
              {!adjusting ? (
                <div className="start-shift__cash">
                  <div>
                    <strong>{money(carriedOver)}</strong>
                    <span>Left in the drawer from the last shift. Count it: it should match.</span>
                  </div>
                  <button
                    className="start-shift__secondary"
                    type="button"
                    onClick={() => setAdjusting(true)}
                  >
                    Count is different
                  </button>
                </div>
              ) : (
                <div className="start-shift__adjust">
                  <label>
                    How much cash is in the drawer now?
                    <span className="start-shift__peso">
                      <span aria-hidden="true">₱</span>
                      <input
                        inputMode="decimal"
                        autoFocus
                        value={floatInput}
                        onChange={(event) =>
                          setFloatInput(event.target.value.replace(/[^\d.]/g, ''))
                        }
                      />
                    </span>
                  </label>
                  {adjusted && (
                    <label>
                      Why is it different? (required)
                      <input
                        value={reason}
                        onChange={(event) => {
                          setReason(event.target.value);
                          setError('');
                        }}
                        placeholder="e.g. Owner took cash for a supplier payment"
                      />
                    </label>
                  )}
                  <button
                    className="start-shift__secondary"
                    type="button"
                    onClick={() => {
                      setAdjusting(false);
                      setFloatInput(String(carriedOver));
                      setReason('');
                    }}
                  >
                    Undo, use {money(carriedOver)}
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="start-shift__footer">
          {error && (
            <p className="pos-notice" role="alert">
              {error}
            </p>
          )}
          <p className="start-shift__summary" aria-live="polite">
            {cashier ? (
              <>
                Cashier: <strong>{cashier}</strong>
                {others.length > 0 && <> · +{others.length} staff</>} · Drawer:{' '}
                <strong>{money(startingCash)}</strong>
              </>
            ) : (
              'Pick the cashier in step 1 to continue.'
            )}
          </p>
          <div className="start-shift__actions">
            <button className="start-shift__cancel" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="start-shift__go" type="submit" disabled={!cashier}>
              Start shift
            </button>
          </div>
        </footer>
      </form>
    </div>,
    getModalHost(),
  );
}

export function EndShiftModal({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<ShiftRecord | null>(null);

  // After closing, the same popup turns into the duty report preview.
  if (report) {
    return <ShiftReportModal shift={report} heading="Shift closed" onClose={onClose} />;
  }

  return createPortal(
    <div className="pos-modal-backdrop">
      <div className="pos-payment-modal cashier-shift-modal close-shift-modal">
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Cash control</p>
        <h2>Close shift</h2>
        <CloseShiftForm
          onDone={(shift) => (shift ? setReport(shift) : onClose())}
          onCancel={onClose}
        />
      </div>
    </div>,
    getModalHost(),
  );
}
const shiftLength = (openedAt: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
};

/**
 * Count the drawer and close the shift. Used by Close shift in the top bar and by the
 * Close shift button on the Cash drawer page, so both do exactly the same thing.
 */
export function CloseShiftForm({
  onDone,
  onCancel,
}: {
  /** Called after the shift is closed, with the saved shift for its duty report. */
  onDone: (shift?: ShiftRecord) => void;
  /** Optional "Keep shift open" button. */
  onCancel?: () => void;
}) {
  const session = getSession();
  const totals = getShiftTotals(session);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();

  if (!session) {
    return (
      <p className="close-shift__empty">
        No shift is running, so there is nothing to close. Use Start shift in the top bar.
      </p>
    );
  }

  const value = Number(counted || 0);
  const variance = Math.round((value - totals.expected) * 100) / 100;
  const hasCount = counted.trim() !== '';
  const balanced = hasCount && Math.abs(variance) < 0.005;
  const state = !hasCount ? 'waiting' : balanced ? 'balanced' : variance < 0 ? 'short' : 'over';
  const names = session.onDutyNames ?? [session.cashierName];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasCount) {
      setError('Count the cash in the drawer and enter the total.');
      return;
    }
    if (!balanced && !note.trim()) {
      setError('The count does not match. Write a short note on why before closing.');
      return;
    }
    try {
      const result = endShift(value, balanced ? undefined : note);
      showToast(
        result
          ? `Shift closed. Counted ${money(value)}${
              balanced
                ? ', drawer balanced.'
                : `, ${variance < 0 ? 'short' : 'over'} by ${money(Math.abs(variance))}.`
            }`
          : 'The shift was already closed.',
        'success',
      );
      onDone(result?.record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not close the shift.');
    }
  }

  return (
    <form className="close-shift" onSubmit={submit} noValidate>
      <p className="close-shift__who">
        <span>
          On duty: <strong>{names.join(', ')}</strong>
        </span>
        <span>
          Started{' '}
          {new Date(session.openedAt).toLocaleTimeString('en-PH', {
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          · {shiftLength(session.openedAt)}
        </span>
      </p>

      <dl className="close-shift__lines" aria-label="What should be in the drawer">
        <div>
          <dt>Opening float</dt>
          <dd>{money(session.openingFloat)}</dd>
        </div>
        <div>
          <dt>Cash sales</dt>
          <dd>+ {money(totals.cashSales)}</dd>
        </div>
        {totals.creditCash > 0 && (
          <div>
            <dt>Utang cash</dt>
            <dd>+ {money(totals.creditCash)}</dd>
          </div>
        )}
        {totals.paidIn > 0 && (
          <div>
            <dt>Cash in</dt>
            <dd>+ {money(totals.paidIn)}</dd>
          </div>
        )}
        {totals.paidOut > 0 && (
          <div>
            <dt>Cash out</dt>
            <dd>− {money(totals.paidOut)}</dd>
          </div>
        )}
        <div className="close-shift__expected">
          <dt>Should be in the drawer</dt>
          <dd>{money(totals.expected)}</dd>
        </div>
      </dl>

      <label className="close-shift__field">
        <span>Cash you counted</span>
        <span className="close-shift__money">
          <i aria-hidden="true">₱</i>
          <input
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={counted}
            onChange={(event) => {
              setCounted(event.target.value.replace(/[^\d.]/g, ''));
              setError('');
            }}
            placeholder="0.00"
          />
        </span>
      </label>

      <div className={`close-shift__result is-${state}`} aria-live="polite">
        {state === 'waiting' && <span>Count every bill and coin, then type the total.</span>}
        {state === 'balanced' && (
          <>
            <span>Drawer balanced</span>
            <strong>{money(0)}</strong>
          </>
        )}
        {(state === 'short' || state === 'over') && (
          <>
            <span>{state === 'short' ? 'Short by' : 'Over by'}</span>
            <strong>{money(Math.abs(variance))}</strong>
          </>
        )}
      </div>

      {(state === 'short' || state === 'over') && (
        <label className="close-shift__field">
          <span>Why it does not match</span>
          <input
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setError('');
            }}
            placeholder={
              state === 'short' ? 'e.g. ₱20 change given twice' : 'e.g. Customer left the change'
            }
          />
        </label>
      )}

      {error && (
        <p className="close-shift__error" role="alert">
          {error}
        </p>
      )}

      <div className="close-shift__actions">
        {onCancel && (
          <button className="close-shift__keep" type="button" onClick={onCancel}>
            Keep shift open
          </button>
        )}
        <button className="close-shift__submit" type="submit">
          Close shift
        </button>
      </div>
      <p className="close-shift__after">
        The count is saved in the Shift report. The store shows Closed until the next shift starts.
      </p>
    </form>
  );
}
