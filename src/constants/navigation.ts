import type { NavigationGroup } from '../types/navigation';

export const CASHIER_NAV_ITEMS: NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/cashier/dashboard', icon: 'dashboard' },
      { label: 'POS', path: '/cashier/pos', icon: 'pos', emphasis: true },
      { label: 'Cash drawer', path: '/cashier/register', icon: 'register' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products & Stock', path: '/admin/products', icon: 'inventory' },
      { label: 'Batches & Expiry', path: '/admin/batches', icon: 'batches' },
      { label: 'Purchasing', path: '/admin/purchases', icon: 'purchases' },
      { label: 'Stock movements', path: '/admin/stock', icon: 'stock' },
      { label: 'Suppliers', path: '/admin/suppliers', icon: 'suppliers' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Transactions', path: '/cashier/transactions', icon: 'transactions' },
      { label: 'Expenses', path: '/admin/expenses', icon: 'expenses' },
      { label: 'Credit accounts', path: '/admin/credits', icon: 'credit' },
      { label: 'Shift report', path: '/cashier/shift-report', icon: 'reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', path: '/cashier/profile', icon: 'profile' },
      { label: 'Log out', icon: 'logout', action: 'logout' },
    ],
  },
];

export const ADMIN_NAV_ITEMS: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', path: '/admin/dashboard', icon: 'dashboard' },
      { label: 'Point of Sale', path: '/cashier/pos', icon: 'pos', emphasis: true },
      { label: 'Cash drawer', path: '/cashier/register', icon: 'register' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products & Stock', path: '/admin/products', icon: 'inventory' },
      { label: 'Batches & Expiry', path: '/admin/batches', icon: 'batches' },
      { label: 'Purchasing', path: '/admin/purchases', icon: 'purchases' },
      { label: 'Stock movements', path: '/admin/stock', icon: 'stock' },
      { label: 'Suppliers', path: '/admin/suppliers', icon: 'suppliers' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Transactions', path: '/cashier/transactions', icon: 'transactions' },
      { label: 'Expenses', path: '/admin/expenses', icon: 'expenses' },
      { label: 'Credit accounts', path: '/admin/credits', icon: 'credit' },
      { label: 'Reports', path: '/admin/reports', icon: 'reports' },
      { label: 'Shift report', path: '/cashier/shift-report', icon: 'reports' },
      { label: 'Staff', path: '/admin/staff', icon: 'staff' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Settings', path: '/admin/settings', icon: 'settings' },
      { label: 'Profile', path: '/cashier/profile', icon: 'profile' },
      { label: 'Log out', icon: 'logout', action: 'logout' },
    ],
  },
];
