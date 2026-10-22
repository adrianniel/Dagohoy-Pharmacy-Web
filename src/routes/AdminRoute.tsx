import { Navigate, Outlet } from 'react-router-dom';
import { USER_ROLE_KEY } from '../constants/app';

export function AdminRoute() {
  return localStorage.getItem(USER_ROLE_KEY) === 'ADMIN' ? (
    <Outlet />
  ) : (
    <Navigate to="/cashier/dashboard" replace />
  );
}
