import { useEffect, useState } from 'react';
import { getSession, isStoreOpen, STORE_STATUS_CHANGE_EVENT } from '../../data/registerSession';
import { CashierIcon } from './CashierIcon';
import { ShiftControls } from './ShiftControls';

interface CashierHeaderProps {
  title: string;
  onOpenSidebar: () => void;
}

/** How long the shift has been running, as hours and minutes. */
function formatElapsed(openedAt: string | undefined, now: number): string {
  if (!openedAt) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function CashierHeader({ title, onOpenSidebar }: CashierHeaderProps) {
  const [storeOpen, setStoreOpen] = useState(isStoreOpen);
  const [onDuty, setOnDuty] = useState(() => getSession()?.onDutyNames ?? []);
  const [openedAt, setOpenedAt] = useState(() => getSession()?.openedAt);
  const [now, setNow] = useState(() => Date.now());
  const today = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    timeZone: 'Asia/Manila',
  }).format(new Date());
  const date = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date());

  useEffect(() => {
    const syncStoreStatus = () => {
      const session = getSession();
      setStoreOpen(isStoreOpen());
      setOnDuty(session?.onDutyNames ?? []);
      setOpenedAt(session?.openedAt);
      setNow(Date.now());
    };
    window.addEventListener(STORE_STATUS_CHANGE_EVENT, syncStoreStatus);
    window.addEventListener('storage', syncStoreStatus);
    return () => {
      window.removeEventListener(STORE_STATUS_CHANGE_EVENT, syncStoreStatus);
      window.removeEventListener('storage', syncStoreStatus);
    };
  }, []);

  // Tick only while a shift is running, so the timer counts up live.
  useEffect(() => {
    if (!storeOpen) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [storeOpen]);

  return (
    <header className="cashier-header">
      <button
        className="cashier-header__menu"
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <CashierIcon name="menu" />
      </button>
      <div className="cashier-header__title">
        <h1>{title}</h1>
      </div>
      <div className="cashier-header__meta">
        <div className={`cashier-store-status${storeOpen ? ' is-open' : ''}`} role="status">
          <span aria-hidden="true" />
          <div>
            {storeOpen && onDuty.length ? (
              <>
                <strong title={onDuty.join(', ')}>
                  Cashier: {onDuty[0]}
                  {onDuty.length > 1 && (
                    <span className="cashier-store-status__others">
                      {' '}
                      +{onDuty.length - 1} staff
                    </span>
                  )}
                </strong>
                <small className="cashier-shift-clock">
                  Time on shift: <b>{formatElapsed(openedAt, now)}</b>
                </small>
              </>
            ) : (
              <>
                <strong>Store Closed</strong>
                <small>Start a shift to begin</small>
              </>
            )}
          </div>
        </div>
        <ShiftControls />
        <div className="cashier-header__date">
          <CashierIcon name="calendar" />
          <span>
            <strong>{today}</strong>
            <small>{date}</small>
          </span>
        </div>
      </div>
    </header>
  );
}
