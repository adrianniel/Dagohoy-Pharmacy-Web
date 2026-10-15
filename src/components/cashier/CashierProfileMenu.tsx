import { cashierProfile } from '../../data/cashierMockData';

export function CashierProfileMenu() {
  return (
    <button className="cashier-profile-menu" type="button" aria-label="Open cashier profile menu">
      <span className="cashier-avatar">{cashierProfile.initials}</span>
      <span className="cashier-profile-menu__copy">
        <strong>{cashierProfile.shortName}</strong>
        <small>{cashierProfile.role}</small>
      </span>
      <span className="cashier-profile-menu__chevron" aria-hidden="true">
        ⌄
      </span>
    </button>
  );
}
