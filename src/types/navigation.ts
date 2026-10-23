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
  | 'staff'
  | 'settings'
  | 'batches'
  | 'purchases'
  | 'stock'
  | 'register';

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
