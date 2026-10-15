import { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ACCESS_TOKEN_KEY, APP_NAME } from '../constants/app';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/cashier/dashboard';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localStorage.setItem(ACCESS_TOKEN_KEY, 'placeholder-token');
    navigate(destination, { replace: true });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">System foundation</p>
        <h1>{APP_NAME}</h1>
        <p className="muted">
          Authentication integration will be connected to the API in a future milestone.
        </p>
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="staff@example.com" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="••••••••" required />
          <button className="button" type="submit">
            Continue to placeholder dashboard
          </button>
        </form>
      </section>
    </main>
  );
}
