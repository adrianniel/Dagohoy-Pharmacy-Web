import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ACCESS_TOKEN_KEY, USER_ROLE_KEY } from '../constants/app';
import pharmacyLogo from '../assets/logo.png';

interface LoginPageProps {
  onClose: () => void;
  isModal?: boolean;
}

export function LoginPage({ onClose, isModal = false }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef<HTMLElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER');
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/cashier/dashboard';

  useEffect(() => {
    if (!isModal) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    emailRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isModal, onClose]);

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
    <div
      className="login-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="login-title"
        aria-modal="true"
        className="auth-card auth-card--modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          className="login-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
        >
          <span aria-hidden="true">×</span>
        </button>
        <button className="login-modal-brand" type="button" onClick={onClose}>
          <img src={pharmacyLogo} alt="" aria-hidden="true" />
          <span className="login-modal-brand__text">
            <strong>DAGOHOY</strong>
            <span>PHARMACY</span>
          </span>
        </button>
        <h1 id="login-title">Welcome back!</h1>
        <p className="muted">Sign in to manage sales, inventory, and your pharmacy team.</p>
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="email">Email</label>
          <input
            ref={emailRef}
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
          <fieldset className="login-role-group">
            <legend>Role</legend>
            <div className="login-role-options">
              <label className="login-role-option">
                <input
                  type="radio"
                  name="role"
                  value="CASHIER"
                  checked={role === 'CASHIER'}
                  onChange={() => setRole('CASHIER')}
                />
                <span>Cashier</span>
              </label>
              <label className="login-role-option">
                <input
                  type="radio"
                  name="role"
                  value="ADMIN"
                  checked={role === 'ADMIN'}
                  onChange={() => setRole('ADMIN')}
                />
                <span>Administrator</span>
              </label>
            </div>
          </fieldset>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>
        <p className="auth-note">Demo workspace · Live authentication is not connected yet.</p>
      </section>
    </div>
  );
}
