import type { CashierIconName } from '../../types/navigation';

interface CashierIconProps {
  name: CashierIconName | 'menu' | 'collapse' | 'search' | 'calendar' | 'arrow' | 'clock';
}

export function CashierIcon({ name }: CashierIconProps) {
  const paths = {
    dashboard: (
      <>
        <rect x="4" y="4" width="9" height="9" rx="2" />
        <rect x="19" y="4" width="9" height="9" rx="2" />
        <rect x="4" y="19" width="9" height="9" rx="2" />
        <rect x="19" y="19" width="9" height="9" rx="2" />
      </>
    ),
    pos: (
      <>
        <path d="M5 6h22v19H5z" />
        <path d="M9 11h14M9 16h5M19 16h4M9 21h3M16 21h7" />
      </>
    ),
    products: (
      <>
        <path d="m16 4 11 6-11 6-11-6z" />
        <path d="m5 16 11 6 11-6M5 22l11 6 11-6" />
      </>
    ),
    transactions: (
      <>
        <path d="M8 5h16v22l-3-2-3 2-3-2-3 2-4-2z" />
        <path d="M12 11h8M12 16h8M12 21h5" />
      </>
    ),
    profile: (
      <>
        <circle cx="16" cy="11" r="6" />
        <path d="M5 28c1-7 5-10 11-10s10 3 11 10" />
      </>
    ),
    logout: (
      <>
        <path d="M14 6H6v20h8M20 10l6 6-6 6M11 16h15" />
      </>
    ),
    menu: (
      <>
        <path d="M5 9h22M5 16h22M5 23h22" />
      </>
    ),
    collapse: (
      <>
        <path d="m19 9-7 7 7 7" />
      </>
    ),
    search: (
      <>
        <circle cx="14" cy="14" r="8" />
        <path d="m20 20 7 7" />
      </>
    ),
    calendar: (
      <>
        <rect x="5" y="7" width="22" height="21" rx="3" />
        <path d="M10 4v6M22 4v6M5 13h22" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 16h18M19 10l6 6-6 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="16" cy="16" r="12" />
        <path d="M16 9v8l5 3" />
      </>
    ),
  };

  return (
    <svg className="cashier-icon" viewBox="0 0 32 32" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
