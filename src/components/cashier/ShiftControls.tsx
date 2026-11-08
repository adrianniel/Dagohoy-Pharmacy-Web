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
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [floatInput, setFloatInput] = useState(String(carriedOver));
  const [adjusting, setAdjusting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const matches = active.filter((staff) =>
    staff.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const adjusted = Math.abs(Number(floatInput || 0) - carriedOver) >= 0.005;

  function toggle(name: string) {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) {
      setError('Select at least one name who is on duty.');
      return;
    }
    if (adjusted && !reason.trim()) {
      setError('Type the reason for adjusting the cash float.');
      return;
    }
    try {
      const started = startShift({
        onDutyNames: selected,
        openingFloat: Number(floatInput || 0),
        adjustmentReason: adjusted ? reason : undefined,
      });
      showToast(`Shift started · ${started.cashierName}`, 'success');
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the shift.');
    }
  }

  return createPortal(
    <div className="pos-modal-backdrop">
      <form className="pos-payment-modal cashier-shift-modal" onSubmit={submit} noValidate>
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Cash control</p>
        <h2>Start shift</h2>
        <p className="inventory-form-note">
          Pick everyone who is working this shift. Receipts show the first name you pick; the full
          list is kept in the shift report.
        </p>

        <label className="cashier-shift-field">
          Search staff on duty
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a name…"
          />
        </label>

        <div className="cashier-shift-roster" role="group" aria-label="Staff on duty">
          {roster.length === 0 ? (
            <p className="cashier-shift-empty">
              No staff registered yet. Ask the administrator to add names in Staff.
            </p>
          ) : matches.length === 0 ? (
            <p className="cashier-shift-empty">No staff matches “{query}”.</p>
          ) : (
            matches.map((staff) => {
              const isSelected = selected.includes(staff.name);
              return (
                <button
                  key={staff.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`cashier-shift-chip${isSelected ? ' is-selected' : ''}`}
                  onClick={() => toggle(staff.name)}
                >
                  <span>{staff.name}</span>
                  {isSelected && (
                    <span className="cashier-shift-chip__index">
                      {selected.indexOf(staff.name) + 1}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {selected.length > 0 && (
          <p className="cashier-shift-picked">
            On duty: <strong>{selected.join(', ')}</strong>
            <br />
            <span>Receipts will show “{selected[0]}”.</span>
          </p>
        )}

        <div className="cashier-shift-float">
          <div>
            <span className="cashier-shift-float__label">Cash float</span>
            {adjusting ? (
              <input
                className="cashier-shift-float__input"
                inputMode="decimal"
                value={floatInput}
                onChange={(event) => setFloatInput(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label="Cash float amount"
              />
            ) : (
              <strong className="cashier-shift-float__value">{money(carriedOver)}</strong>
            )}
            <span className="cashier-shift-float__note">
              Carried over from the last shift. Locked unless adjusted.
            </span>
          </div>
          {!adjusting ? (
            <button
              className="cashier-view-button"
              type="button"
              onClick={() => setAdjusting(true)}
            >
              Adjust
            </button>
          ) : (
            <button
              className="cashier-view-button"
              type="button"
              onClick={() => {
                setAdjusting(false);
                setFloatInput(String(carriedOver));
                setReason('');
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {adjusted && (
          <label>
            Reason for the float adjustment (required)
            <input
              required
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError('');
              }}
              placeholder="e.g. Cash removed for a supplier payment"
            />
          </label>
        )}

        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}

        <button className="pos-checkout-button" type="submit">
          Start shift
        </button>
      </form>
    </div>,
    getModalHost(),
  );
}

export function EndShiftModal({ onClose }: { onClose: () => void }) {
  const session = getSession();
  const expected = getShiftTotals().expected;
  const [counted, setCounted] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const value = Number(counted || 0);
  const variance = value - expected;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!counted.trim()) {
      setError('Enter the cash you counted in the drawer.');
      return;
    }
    try {
      const result = endShift(value);
      showToast(
        `Shift closed · counted ${money(value)}${result ? ` · variance ${money(result.variance)}` : ''}`,
        'success',
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not end the shift.');
    }
  }

  return createPortal(
    <div className="pos-modal-backdrop">
      <form className="pos-payment-modal cashier-shift-modal" onSubmit={submit} noValidate>
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Cash control</p>
        <h2>Close shift</h2>
        <p className="inventory-form-note">
          Count the drawer, then close the register. The handover is saved for the next shift.
        </p>
        {session && (
          <p className="cashier-shift-picked">
            On duty: <strong>{(session.onDutyNames ?? [session.cashierName]).join(', ')}</strong>
          </p>
        )}
        <div className="pos-payment-total">
          <span>Expected cash in drawer</span>
          <strong>{money(expected)}</strong>
        </div>
        <label>
          Counted cash
          <input
            required
            autoFocus
            inputMode="decimal"
            value={counted}
            onChange={(event) => {
              setCounted(event.target.value.replace(/[^\d.]/g, ''));
              setError('');
            }}
            placeholder="0.00"
          />
        </label>
        {counted.trim() !== '' && (
          <p
            className={`cashier-shift-variance${Math.abs(variance) < 0.005 ? ' is-balanced' : ''}`}
          >
            {Math.abs(variance) < 0.005
              ? 'Drawer is balanced.'
              : `${variance > 0 ? 'Over' : 'Short'} by ${money(Math.abs(variance))}`}
          </p>
        )}
        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}
        <button className="pos-checkout-button" type="submit">
          Close shift and reconcile
        </button>
      </form>
    </div>,
    getModalHost(),
  );
}
