import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signIn } from '../data/accountStore';
import pharmacyLogo from '../assets/logo.png';

interface LoginPageProps {
  onClose: () => void;
  isModal?: boolean;
}

export function LoginPage({ onClose, isModal = false }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef<HTMLElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/cashier/dashboard';

  useEffect(() => {
    if (!isModal) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    usernameRef.current?.focus();

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const result = await signIn(
      String(form.get('username') ?? ''),
      String(form.get('password') ?? ''),
      role,
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const target =
      role === 'ADMIN'
        ? destination === '/cashier/dashboard'
          ? '/admin/dashboard'
          : destination
        : destination.startsWith('/admin')
          ? '/cashier/dashboard'
          : destination;
    navigate(target, { replace: true });
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
        className={`auth-card auth-card--modal${role === 'ADMIN' ? ' auth-card--admin' : ''}`}
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
        <p className="muted">Sign in with the username and password the owner gave you.</p>
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="username">Username</label>
          <input
            ref={usernameRef}
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Your username"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            onChange={() => setError('')}
          />
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="••••••••"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              onChange={() => setError('')}
            />
            <button
              className="password-toggle"
              type="button"
              aria-controls="password"
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <fieldset className="login-role-group">
            <legend>Role</legend>
            <div className="login-role-options">
              <label className="login-role-option">
                <input
                  type="radio"
                  name="role"
                  value="CASHIER"
                  checked={role === 'CASHIER'}
                  onChange={() => {
                    setRole('CASHIER');
                    setError('');
                  }}
                />
                <span>Cashier</span>
              </label>
              <label className="login-role-option">
                <input
                  type="radio"
                  name="role"
                  value="ADMIN"
                  checked={role === 'ADMIN'}
                  onChange={() => {
                    setRole('ADMIN');
                    setError('');
                  }}
                />
                <span>Administrator</span>
              </label>
            </div>
          </fieldset>
          {error && (
            <p className="login-error" id="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-note">Forgot your password? Ask the pharmacy owner to reset it.</p>
      </section>
    </div>
  );
}
