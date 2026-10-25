import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CashierHeader } from '../components/cashier/CashierHeader';
import { CashierSidebar } from '../components/cashier/CashierSidebar';

const routeTitles: Record<string, string> = {
  '/cashier/dashboard': 'Dashboard',
  '/cashier/pos': 'Point of Sale',
  '/cashier/register': 'Cash drawer',
  '/cashier/products': 'Products & Stock',
  '/cashier/transactions': 'Transactions',
  '/cashier/profile': 'My Profile',
  '/admin/dashboard': 'Overview',
  '/admin/products': 'Products & Stock',
  '/admin/batches': 'Batches & Expiry',
  '/admin/purchases': 'Purchasing & Receiving',
  '/admin/stock': 'Stock Movements',
  '/admin/suppliers': 'Suppliers',
  '/admin/reports': 'Reports',
  '/admin/staff': 'Staff',
  '/admin/settings': 'Settings',
};

export function CashierLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = routeTitles[location.pathname] ?? 'Cashier Workspace';

  return (
    <>
      <a className="cashier-skip-link" href="#workspace-content">
        Skip to workspace content
      </a>
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
            subtitle={
              location.pathname.startsWith('/admin') ? 'Owner workspace' : 'Cashier workspace'
            }
            onOpenSidebar={() => setMobileOpen(true)}
          />
          <main className="cashier-content" id="workspace-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
