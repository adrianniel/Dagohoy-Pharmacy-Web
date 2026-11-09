import { NavLink, useNavigate } from 'react-router-dom';
import pharmacyLogo from '../../assets/logo.png';
import { ADMIN_NAV_ITEMS, CASHIER_NAV_ITEMS } from '../../constants/navigation';
import { getCurrentAccount, getWorkspaceProfile, signOut } from '../../data/accountStore';
import { useStoreStatusRefresh } from '../../data/useStoreStatusRefresh';
import { CashierIcon } from './CashierIcon';

interface CashierSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export function CashierSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: CashierSidebarProps) {
  const navigate = useNavigate();
  const role = getCurrentAccount()?.role;
  const navigation = role === 'ADMIN' ? ADMIN_NAV_ITEMS : CASHIER_NAV_ITEMS;
  useStoreStatusRefresh();
  const profile = getWorkspaceProfile();
  const workspaceLabel = role === 'ADMIN' ? 'Owner workspace' : 'Cashier workspace';

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <button
        className={`cashier-sidebar-backdrop${mobileOpen ? ' is-visible' : ''}`}
        type="button"
        aria-label="Close navigation"
        onClick={onCloseMobile}
      />
      <aside
        className={`cashier-sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}
      >
        <div className="cashier-sidebar__brand">
          <img src={pharmacyLogo} alt="" />
          <span>
            <strong>Dagohoy</strong>
            <small>PHARMACY</small>
          </span>
        </div>
        <p className="cashier-sidebar__workspace">{workspaceLabel}</p>

        <nav className="cashier-sidebar__nav" aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="cashier-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) =>
                item.path ? (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `cashier-nav-item${isActive ? ' is-active' : ''}${item.emphasis ? ' is-emphasis' : ''}`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <CashierIcon name={item.icon} />
                    <span>{item.label}</span>
                    {item.emphasis && <small>Sell</small>}
                  </NavLink>
                ) : (
                  <button
                    className="cashier-nav-item"
                    type="button"
                    key={item.label}
                    title={collapsed ? item.label : undefined}
                    onClick={item.action === 'logout' ? handleLogout : undefined}
                  >
                    <CashierIcon name={item.icon} />
                    <span>{item.label}</span>
                  </button>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className="cashier-sidebar__user">
          <span className="cashier-avatar">{profile.initials}</span>
          <span>
            <strong>{profile.shortName}</strong>
            <small>{profile.status}</small>
          </span>
        </div>
        <button
          className="cashier-sidebar__collapse"
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CashierIcon name="collapse" />
          <span>Collapse sidebar</span>
        </button>
      </aside>
    </>
  );
}
