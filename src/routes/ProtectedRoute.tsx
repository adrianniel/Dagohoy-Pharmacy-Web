import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentAccount, refreshSession } from '../data/accountStore';
import { SESSION_EXPIRED_EVENT } from '../services/apiClient';

type Check = 'checking' | 'ok' | 'out' | 'offline';

/**
 * Workspace pages show only after the server confirms the login session.
 * The check runs again when the window regains focus, and any 401 from the API
 * (expired, logged out elsewhere, account disabled) sends the user to log in.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const [check, setCheck] = useState<Check>('checking');

  useEffect(() => {
    let alive = true;
    const verify = () =>
      refreshSession()
        .then(() => alive && setCheck('ok'))
        .catch((error: { statusCode?: number }) => {
          if (!alive) return;
          // Server unreachable: keep working with the last confirmed login, say so.
          setCheck(error.statusCode === 401 ? 'out' : getCurrentAccount() ? 'ok' : 'offline');
        });
    const expired = () => setCheck('out');
    void verify();
    window.addEventListener('focus', verify);
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => {
      alive = false;
      window.removeEventListener('focus', verify);
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    };
  }, []);

  if (check === 'out') return <Navigate to="/login" replace state={{ from: location }} />;
  if (check === 'offline') {
    return (
      <div className="session-check" role="alert">
        <strong>Cannot reach the server.</strong>
        <span>Check that the API is running and the internet is on, then reload this page.</span>
        <button className="button" type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
  if (check === 'checking') {
    return (
      <div className="session-check" role="status">
        Checking your login…
      </div>
    );
  }
  return <Outlet />;
}
