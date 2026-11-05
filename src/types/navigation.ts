export type UserRole = 'ADMIN' | 'CASHIER';

export type CashierIconName =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'transactions'
  | 'profile'
  | 'logout'
  | 'inventory'
  | 'suppliers'
  | 'reports'
  | 'expenses'
  | 'credit'
  | 'staff'
  | 'settings'
  | 'batches'
  | 'purchases'
  | 'stock'
  | 'register'
  | 'cart';

export interface NavigationItem {
  label: string;
  path?: string;
  icon: CashierIconName;
  emphasis?: boolean;
  action?: 'logout';
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}
