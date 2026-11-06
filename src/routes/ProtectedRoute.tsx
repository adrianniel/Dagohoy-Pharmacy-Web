import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentAccount, signOut } from '../data/accountStore';

export function ProtectedRoute() {
  const location = useLocation();
  const account = getCurrentAccount();

  if (!account || account.status !== 'Active') {
    // Clears stale sessions, such as an account that was disabled or removed.
    signOut();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
