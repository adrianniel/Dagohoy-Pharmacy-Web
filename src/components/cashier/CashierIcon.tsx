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
    cart: (
      <>
        <path d="M5 6h2.5l2.4 13.1a2.1 2.1 0 0 0 2 1.7h7.4a2.1 2.1 0 0 0 2-1.6L22.5 10H9.2" />
        <circle cx="14" cy="25.8" r="1.4" />
        <circle cx="19.5" cy="25.8" r="1.4" />
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
    inventory: (
      <>
        <path d="M4 10h24v17H4zM3 5h26v5H3zM12 15h8" />
      </>
    ),
    suppliers: (
      <>
        <path d="M3 27h26M6 27V9l10-5 10 5v18M11 13h2m6 0h2m-10 5h2m6 0h2m-8 9v-5h6v5" />
      </>
    ),
    reports: (
      <>
        <path d="M5 27V16h6v11M13 27V6h6v21M21 27V11h6v16" />
      </>
    ),
    expenses: (
      <>
        <path d="M6 5h20v22H6zM10 10h12M10 15h12M10 20h5" />
        <circle cx="22" cy="23" r="5" />
        <path d="M22 20v6M20.5 21.5h2.2" />
      </>
    ),
    credit: (
      <>
        <rect x="4" y="7" width="24" height="18" rx="3" />
        <path d="M4 13h24M9 20h5" />
        <path d="M23 4v6M20 7h6" />
      </>
    ),
    staff: (
      <>
        <circle cx="12" cy="11" r="5" />
        <path d="M3 28c0-6 3-9 9-9s9 3 9 9m0-18a5 5 0 0 1 0 10m2 2c4 1 6 3 6 6" />
      </>
    ),
    settings: (
      <>
        <circle cx="16" cy="16" r="4" />
        <path d="m13 3-1 3-3 2-3-1-2 4 2 2v4l-2 2 2 4 3-1 3 2 1 3h6l1-3 3-2 3 1 2-4-2-2v-4l2-2-2-4-3 1-3-2-1-3z" />
      </>
    ),
    batches: (
      <>
        <path d="M7 4h18v24H7zM11 9h10M11 14h10M11 19h6" />
        <path d="M4 8v20" />
      </>
    ),
    purchases: (
      <>
        <path d="M5 7h22l-2 20H7L5 7zM11 11V8a5 5 0 0 1 10 0v3M12 17h8" />
      </>
    ),
    stock: (
      <>
        <path d="M5 7h22M5 16h22M5 25h22M11 4v6m10 3v6M15 22v6" />
        <circle cx="11" cy="7" r="3" />
        <circle cx="21" cy="16" r="3" />
        <circle cx="15" cy="25" r="3" />
      </>
    ),
    register: (
      <>
        <path d="M5 10h22v17H5zM8 10V5h16v5M10 15h12v4H10zM12 23h2m4 0h2" />
      </>
    ),
  };

  return (
    <svg className="cashier-icon" viewBox="0 0 32 32" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
