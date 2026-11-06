import { Link } from 'react-router-dom';
import { getWorkspaceProfile } from '../../data/accountStore';
import { useStoreStatusRefresh } from '../../data/useStoreStatusRefresh';

export function CashierProfileMenu() {
  useStoreStatusRefresh();
  const profile = getWorkspaceProfile();
  return (
    <Link className="cashier-profile-menu" to="/cashier/profile" aria-label="Open profile">
      <span className="cashier-avatar">{profile.initials}</span>
      <span className="cashier-profile-menu__copy">
        <strong>{profile.shortName}</strong>
        <small>{profile.roleLabel}</small>
      </span>
      <span className="cashier-profile-menu__chevron" aria-hidden="true">
        ⌄
      </span>
    </Link>
  );
}
