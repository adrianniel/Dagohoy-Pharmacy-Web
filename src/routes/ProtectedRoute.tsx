import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ACCESS_TOKEN_KEY } from '../constants/app';

export function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
