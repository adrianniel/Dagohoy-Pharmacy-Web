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
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const role = result.account.role;
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
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            onChange={() => setError('')}
          />
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
