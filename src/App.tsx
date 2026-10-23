import { Navigate, Route, Routes } from 'react-router-dom';
import { CashierLayout } from './layouts/CashierLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { CashierDashboardPage } from './pages/cashier/DashboardPage';
import { CashierPosPage } from './pages/cashier/PosPage';
import { CashierProductsPage } from './pages/cashier/ProductsPage';
import { CashierProfilePage } from './pages/cashier/ProfilePage';
import { CashierTransactionsPage } from './pages/cashier/TransactionsPage';
import { AdminPage } from './pages/admin/AdminPage';
import { AdminRoute } from './routes/AdminRoute';
import { OperationsPage } from './pages/admin/OperationsPage';
import { RegisterPage } from './pages/cashier/RegisterPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/cashier" element={<CashierLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CashierDashboardPage />} />
          <Route path="pos" element={<CashierPosPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="products" element={<CashierProductsPage />} />
          <Route path="transactions" element={<CashierTransactionsPage />} />
          <Route path="profile" element={<CashierProfilePage />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<CashierLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminPage section="dashboard" />} />
            <Route path="products" element={<AdminPage section="products" />} />
            <Route path="batches" element={<OperationsPage section="batches" />} />
            <Route path="purchases" element={<OperationsPage section="purchases" />} />
            <Route path="stock" element={<OperationsPage section="stock" />} />
            <Route path="suppliers" element={<AdminPage section="suppliers" />} />
            <Route path="reports" element={<AdminPage section="reports" />} />
            <Route path="staff" element={<AdminPage section="staff" />} />
            <Route path="settings" element={<AdminPage section="settings" />} />
          </Route>
        </Route>
        <Route path="/dashboard" element={<Navigate to="/cashier/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/cashier/dashboard" replace />} />
    </Routes>
  );
}
