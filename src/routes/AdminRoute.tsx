import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentAccount } from '../data/accountStore';

export function AdminRoute() {
  return getCurrentAccount()?.role === 'ADMIN' ? (
    <Outlet />
  ) : (
    <Navigate to="/cashier/dashboard" replace />
  );
}
