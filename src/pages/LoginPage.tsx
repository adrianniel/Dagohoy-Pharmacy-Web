import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ACCESS_TOKEN_KEY, APP_NAME, USER_ROLE_KEY } from '../constants/app';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('ADMIN');
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/cashier/dashboard';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localStorage.setItem(ACCESS_TOKEN_KEY, 'placeholder-token');
    localStorage.setItem(USER_ROLE_KEY, role);
    navigate(
      destination === '/cashier/dashboard' && role === 'ADMIN' ? '/admin/dashboard' : destination,
      { replace: true },
    );
  }

  return (
    <main className="auth-shell">
      <aside className="auth-introduction">
        <Link to="/" className="auth-home-link">
          Dagohoy Pharmacy
        </Link>
        <span className="auth-introduction__badge">Your daily operations, simplified</span>
        <h2>
          More time for care.
          <br />
          Less time on paperwork.
        </h2>
        <p>One workspace for your counter, inventory, and pharmacy team.</p>
        <ul>
          <li>Fast barcode checkout and stock receiving</li>
          <li>Clear batch and expiry tracking</li>
          <li>Sales, expenses, and credit in one place</li>
        </ul>
      </aside>
      <section className="auth-card">
        <p className="eyebrow">Pharmacy operations</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage sales, inventory, and your pharmacy team.</p>
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            placeholder="staff@example.com"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <label htmlFor="role">Workspace</label>
          <select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value as 'ADMIN' | 'CASHIER')}
          >
            <option value="ADMIN">Owner / administrator</option>
            <option value="CASHIER">Cashier</option>
          </select>
          <button className="button" type="submit">
            Sign in to {APP_NAME}
          </button>
        </form>
        <p className="auth-note">Demo workspace · Live authentication is not connected yet.</p>
      </section>
    </main>
  );
}
