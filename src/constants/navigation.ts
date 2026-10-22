import type { NavigationGroup } from '../types/navigation';

export const CASHIER_NAV_ITEMS: NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/cashier/dashboard', icon: 'dashboard' },
      { label: 'POS', path: '/cashier/pos', icon: 'pos', emphasis: true },
      { label: 'Products', path: '/cashier/products', icon: 'products' },
      { label: 'Transactions', path: '/cashier/transactions', icon: 'transactions' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', path: '/cashier/profile', icon: 'profile' },
      { label: 'Logout', icon: 'logout', action: 'logout' },
    ],
  },
];

export const ADMIN_NAV_ITEMS: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', path: '/admin/dashboard', icon: 'dashboard' },
      { label: 'Point of Sale', path: '/cashier/pos', icon: 'pos', emphasis: true },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products & Stock', path: '/admin/products', icon: 'inventory' },
      { label: 'Suppliers', path: '/admin/suppliers', icon: 'suppliers' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Transactions', path: '/cashier/transactions', icon: 'transactions' },
      { label: 'Reports', path: '/admin/reports', icon: 'reports' },
      { label: 'Staff', path: '/admin/staff', icon: 'staff' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Settings', path: '/admin/settings', icon: 'settings' },
      { label: 'Profile', path: '/cashier/profile', icon: 'profile' },
      { label: 'Logout', icon: 'logout', action: 'logout' },
    ],
  },
];
