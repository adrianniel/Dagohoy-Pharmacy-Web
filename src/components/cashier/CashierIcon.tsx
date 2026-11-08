import type { CashierIconName } from '../../types/navigation';

interface CashierIconProps {
  name:
    | CashierIconName
    | 'menu'
    | 'collapse'
    | 'search'
    | 'calendar'
    | 'arrow'
    | 'clock'
    | 'cash'
    | 'phone'
    | 'mail'
    | 'map'
    | 'store'
    | 'pin'
    | 'chevron'
    | 'return'
    | 'adjustments'
    | 'trash'
    | 'receipt'
    | 'close'
    | 'minus'
    | 'plus'
    | 'nocharge'
    | 'sound'
    | 'mute';
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
    cash: (
      <>
        <rect x="2" y="9" width="28" height="15" rx="2" />
        <circle cx="16" cy="16.5" r="4" />
        <path d="M7 14.5h.01M25 18.5h.01" />
      </>
    ),
    phone: (
      <>
        <rect x="9" y="3" width="14" height="26" rx="3" />
        <path d="M13 7h6M16 24.5h.01" />
      </>
    ),
    mail: (
      <>
        <rect x="4" y="8" width="24" height="16" rx="2" />
        <path d="m4 10 12 8 12-8" />
      </>
    ),
    map: (
      <>
        <path d="M16 4a7 7 0 0 1 7 7c0 5.25-7 17-7 17S9 16.25 9 11a7 7 0 0 1 7-7z" />
        <circle cx="16" cy="11" r="2.5" />
      </>
    ),
    store: (
      <>
        <path d="M2 6h28v5H2zM4 11h24v16H4zM10 16h4v11h-4zM18 16h4v11h-4z" />
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
    return: (
      <>
        <path d="M4 22h18M4 22l4-5h9l3 5" />
        <path d="m12 9 4 4-4 4" />
        <path d="M22 16h6M22 16l3-3M22 16l3 3" />
      </>
    ),
    adjustments: (
      <>
        <path d="M6 26 26 6" />
        <path d="M11 6H6v5M21 26h5v-5" />
        <path d="M12 20h8M16 16v8" />
      </>
    ),
    pin: (
      <>
        <path d="M16 4a7 7 0 0 1 7 7c0 5-7 12-7 12S9 16 9 11a7 7 0 0 1 7-7z" />
        <circle cx="16" cy="11" r="2.6" />
      </>
    ),
    chevron: (
      <>
        <path d="m12 7 9 9-9 9" />
      </>
    ),
    trash: (
      <>
        <path d="M6 9h20" />
        <path d="M13 9V5.5h6V9" />
        <path d="M8 9l1.6 17.2a2 2 0 0 0 2 1.8h8.8a2 2 0 0 0 2-1.8L24 9" />
        <path d="M13.5 14v8.5M18.5 14v8.5" />
      </>
    ),
    receipt: (
      <>
        <path d="M8 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v22l-2.7-2-2.6 2-2.7-2-2.7 2-2.6-2L8 28z" />
        <path d="M12 10h8M12 15h8M12 20h5" />
      </>
    ),
    close: (
      <>
        <path d="M8 8l16 16M24 8L8 24" />
      </>
    ),
    minus: (
      <>
        <path d="M8 16h16" />
      </>
    ),
    plus: (
      <>
        <path d="M8 16h16M16 8v16" />
      </>
    ),
    sound: (
      <>
        <path d="M5 12h5l7-6v20l-7-6H5z" />
        <path d="M21.5 11.5a6 6 0 0 1 0 9M25 8a11 11 0 0 1 0 16" />
      </>
    ),
    mute: (
      <>
        <path d="M5 12h5l7-6v20l-7-6H5z" />
        <path d="M21 12l7 8M28 12l-7 8" />
      </>
    ),
    nocharge: (
      <>
        <circle cx="16" cy="16" r="12.5" />
        <path d="M13.5 22.5V10h3a3 3 0 0 1 0 6h-3" />
        <path d="M11 12.2h9.5M11 14.6h9.5" />
        <path d="M7.4 7.4l17.2 17.2" />
      </>
    ),
  };

  return (
    <svg className="cashier-icon" viewBox="0 0 32 32" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
