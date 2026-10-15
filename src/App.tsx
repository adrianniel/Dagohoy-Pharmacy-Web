import { Navigate, Route, Routes } from 'react-router-dom';
import { CashierLayout } from './layouts/CashierLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { CashierDashboardPage } from './pages/cashier/DashboardPage';
import { CashierPosPage } from './pages/cashier/PosPage';
import { CashierProductsPage } from './pages/cashier/ProductsPage';
import { CashierProfilePage } from './pages/cashier/ProfilePage';
import { CashierTransactionsPage } from './pages/cashier/TransactionsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/cashier" element={<CashierLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CashierDashboardPage />} />
          <Route path="pos" element={<CashierPosPage />} />
          <Route path="products" element={<CashierProductsPage />} />
          <Route path="transactions" element={<CashierTransactionsPage />} />
          <Route path="profile" element={<CashierProfilePage />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/cashier/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/cashier/dashboard" replace />} />
    </Routes>
  );
}
