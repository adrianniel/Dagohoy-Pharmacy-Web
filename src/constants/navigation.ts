import type { NavigationGroup } from '../types/navigation';

export const CASHIER_NAV_ITEMS: NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/cashier/dashboard', icon: 'dashboard' },
      { label: 'Sales Counter', path: '/cashier/pos', icon: 'pos', emphasis: true },
      { label: 'Cash drawer', path: '/cashier/register', icon: 'register' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products & Stock', path: '/admin/products', icon: 'inventory' },
      { label: 'Stock movements', path: '/admin/stock', icon: 'stock' },
      { label: 'Suppliers', path: '/admin/suppliers', icon: 'suppliers' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Transactions', path: '/cashier/transactions', icon: 'transactions' },
      { label: 'Credit accounts', path: '/admin/credits', icon: 'credit' },
      { label: 'Shift report', path: '/cashier/shift-report', icon: 'reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Subscription', path: '/admin/subscription', icon: 'purchases' },
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
      { label: 'Sales Counter', path: '/cashier/pos', icon: 'pos', emphasis: true },
      { label: 'Cash drawer', path: '/cashier/register', icon: 'register' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products & Stock', path: '/admin/products', icon: 'inventory' },
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
      { label: 'Duty reports', path: '/cashier/shift-report', icon: 'transactions' },
      { label: 'Staff', path: '/admin/staff', icon: 'staff' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Settings', path: '/admin/settings', icon: 'settings' },
      { label: 'Subscription', path: '/admin/subscription', icon: 'purchases' },
      { label: 'Profile', path: '/cashier/profile', icon: 'profile' },
      { label: 'Log out', icon: 'logout', action: 'logout' },
    ],
  },
];
