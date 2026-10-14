import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ACCESS_TOKEN_KEY, APP_NAME } from '../constants/app';

export function AppLayout() {
  const navigate = useNavigate();

  function signOut() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">POS & Inventory</p>
          <h1>{APP_NAME}</h1>
        </div>
        <button className="button button--secondary" type="button" onClick={signOut}>
          Sign out
        </button>
      </header>
      <nav className="app-nav" aria-label="Primary navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
        >
          Dashboard
        </NavLink>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
