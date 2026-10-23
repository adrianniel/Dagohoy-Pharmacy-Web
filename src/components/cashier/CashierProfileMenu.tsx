import { Link } from 'react-router-dom';
import { USER_ROLE_KEY } from '../../constants/app';
import { adminProfile, cashierProfile } from '../../data/cashierMockData';

export function CashierProfileMenu() {
  const profile = localStorage.getItem(USER_ROLE_KEY) === 'ADMIN' ? adminProfile : cashierProfile;
  return (
    <Link className="cashier-profile-menu" to="/cashier/profile" aria-label="Open profile">
      <span className="cashier-avatar">{profile.initials}</span>
      <span className="cashier-profile-menu__copy">
        <strong>{profile.shortName}</strong>
        <small>{profile.role}</small>
      </span>
      <span className="cashier-profile-menu__chevron" aria-hidden="true">
        ⌄
      </span>
    </Link>
  );
}
