import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CashierHeader } from '../components/cashier/CashierHeader';
import { CashierSidebar } from '../components/cashier/CashierSidebar';

const routeTitles: Record<string, string> = {
  '/cashier/dashboard': 'Dashboard',
  '/cashier/pos': 'Point of Sale',
  '/cashier/products': 'Products & Stock',
  '/cashier/transactions': 'Transactions',
  '/cashier/profile': 'My Profile',
};

export function CashierLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = routeTitles[location.pathname] ?? 'Cashier Workspace';

  return (
    <div className={`cashier-shell${collapsed ? ' is-sidebar-collapsed' : ''}`}>
      <CashierSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((current) => !current)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="cashier-workspace">
        <CashierHeader
          title={title}
          subtitle="Cashier workspace"
          onOpenSidebar={() => setMobileOpen(true)}
        />
        <main className="cashier-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
