import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LoadingState } from './components/LoadingState';
import { CashierLayout } from './layouts/CashierLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminRoute } from './routes/AdminRoute';
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const CashierDashboardPage = lazy(() =>
  import('./pages/cashier/DashboardPage').then((module) => ({
    default: module.CashierDashboardPage,
  })),
);
const CashierPosPage = lazy(() =>
  import('./pages/cashier/PosPage').then((module) => ({ default: module.CashierPosPage })),
);
const CashierProductsPage = lazy(() =>
  import('./pages/cashier/ProductsPage').then((module) => ({
    default: module.CashierProductsPage,
  })),
);
const CashierProfilePage = lazy(() =>
  import('./pages/cashier/ProfilePage').then((module) => ({
    default: module.CashierProfilePage,
  })),
);
const CashierTransactionsPage = lazy(() =>
  import('./pages/cashier/TransactionsPage').then((module) => ({
    default: module.CashierTransactionsPage,
  })),
);
const AdminPage = lazy(() =>
  import('./pages/admin/AdminPage').then((module) => ({ default: module.AdminPage })),
);
const OperationsPage = lazy(() =>
  import('./pages/admin/OperationsPage').then((module) => ({ default: module.OperationsPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/cashier/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const ExpensesPage = lazy(() =>
  import('./pages/admin/ExpensesPage').then((module) => ({ default: module.ExpensesPage })),
);
const CreditPage = lazy(() =>
  import('./pages/admin/CreditPage').then((module) => ({ default: module.CreditPage })),
);

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { backgroundLocation?: typeof location } | null;
  const backgroundLocation =
    routeState?.backgroundLocation ??
    (location.pathname === '/login'
      ? { ...location, pathname: '/', search: '', hash: '', state: null }
      : null);

  function closeLogin() {
    if (routeState?.backgroundLocation) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <Suspense fallback={<LoadingState label="Loading workspace…" />}>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onClose={closeLogin} />} />
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
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="credits" element={<CreditPage />} />
              <Route path="staff" element={<AdminPage section="staff" />} />
              <Route path="settings" element={<AdminPage section="settings" />} />
            </Route>
          </Route>
          <Route path="/dashboard" element={<Navigate to="/cashier/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/cashier/dashboard" replace />} />
      </Routes>
      {backgroundLocation && location.pathname === '/login' && (
        <Routes location={location}>
          <Route path="/login" element={<LoginPage onClose={closeLogin} isModal />} />
        </Routes>
      )}
    </Suspense>
  );
}
