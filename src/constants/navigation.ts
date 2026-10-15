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

// Intentionally separate so the owner navigation can be added without rewriting the cashier UI.
export const ADMIN_NAV_ITEMS: NavigationGroup[] = [];
