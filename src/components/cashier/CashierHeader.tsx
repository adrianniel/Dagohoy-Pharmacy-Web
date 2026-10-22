import { CashierIcon } from './CashierIcon';
import { CashierProfileMenu } from './CashierProfileMenu';

interface CashierHeaderProps {
  title: string;
  subtitle: string;
  onOpenSidebar: () => void;
}

export function CashierHeader({ title, subtitle, onOpenSidebar }: CashierHeaderProps) {
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
        <p>{subtitle}</p>
        <h1>{title}</h1>
      </div>
      <div className="cashier-header__meta">
        <div className="cashier-header__date">
          <CashierIcon name="calendar" />
          <span>
            <strong>{today}</strong>
            <small>{date}</small>
          </span>
        </div>
        <CashierProfileMenu />
      </div>
    </header>
  );
}
