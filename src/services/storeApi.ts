import { apiRequest } from './apiClient';

/* Products, suppliers, staff roster and store settings on the server. */

export type ApiProduct = {
  id: number;
  barcode: string | null;
  name: string;
  detail: string;
  category: string | null;
  unit: string;
  price: number | null;
  cost: number | null;
  onHand: number;
  reorderPoint: number | null;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  barcode: string;
  detail: string;
  category: string;
  unit: string;
  price: number;
  cost?: number | null;
  opening?: { quantity: number; lot: string; expiry: string };
};

export const listProducts = () => apiRequest<ApiProduct[]>('/products');

export const createProduct = (input: ProductInput) =>
  apiRequest<ApiProduct>('/products', { method: 'POST', body: JSON.stringify(input) });

export const updateProduct = (id: number, changes: Partial<Omit<ProductInput, 'opening'>>) =>
  apiRequest<ApiProduct>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });

export type ApiSupplier = {
  id: number;
  name: string;
  contact: string;
  status: 'Active' | 'Inactive';
};

export const listSuppliers = () => apiRequest<ApiSupplier[]>('/suppliers');

export const createSupplier = (input: { name: string; contact: string }) =>
  apiRequest<ApiSupplier>('/suppliers', { method: 'POST', body: JSON.stringify(input) });

/** Archive (active false) or restore (active true) a supplier. Past deliveries keep its name. */
export const setSupplierActive = (id: number, active: boolean) =>
  apiRequest<ApiSupplier>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });

export type ApiStaff = {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
};

export const listStaff = () => apiRequest<ApiStaff[]>('/staff');

export const addStaff = (name: string) =>
  apiRequest<ApiStaff>('/staff', { method: 'POST', body: JSON.stringify({ name }) });

export const updateStaff = (id: string | number, changes: { name?: string; active?: boolean }) =>
  apiRequest<ApiStaff>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });

export const removeStaff = (id: string | number) =>
  apiRequest<void>(`/staff/${id}`, { method: 'DELETE' });

export type ApiSettings = {
  name: string;
  address: string;
  phone: string;
  email: string;
  businessHours: string;
  lowStockThreshold: number;
  gcashNumber: string;
  gcashQrUrl: string;
};

export const getSettings = () => apiRequest<ApiSettings>('/settings');

export const saveSettings = (settings: ApiSettings) =>
  apiRequest<ApiSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) });

/* ---- Stock: lots, the ledger, deliveries and adjustments ---- */

export type ApiLot = {
  id: number;
  productId: number;
  barcode: string | null;
  product: string;
  lot: string;
  expiry: string | null;
  onHand: number;
  receivedAt: string | null;
  unitCost: number | null;
  supplier: string | null;
};

export type ApiMovement = {
  id: number;
  date: string;
  product: string;
  kind: 'Received' | 'Adjustment' | 'Sale' | 'Return' | 'Damaged' | 'Customer return';
  change: number;
  reference: string;
  staff: string;
  reason: string;
  unitCost: number | null;
};

export const listLots = () => apiRequest<ApiLot[]>('/stock/lots');

export const listMovements = () => apiRequest<ApiMovement[]>('/stock/movements');

export const receiveStock = (input: {
  productId: number;
  quantity: number;
  unitCost: number;
  lot: string;
  expiry: string;
  supplier?: string;
  reference?: string;
  sellingPrice?: number;
}) =>
  apiRequest<{ batchId: number; onHand: number }>('/stock/receive', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export type AdjustmentKind =
  'damaged' | 'missing' | 'count-less' | 'count-more' | 'customer-return' | 'supplier-return';

export const adjustStock = (input: {
  productId: number;
  batchId?: number;
  kind: AdjustmentKind;
  quantity: number;
  reason: string;
  reference?: string;
}) =>
  apiRequest<{ onHand: number }>('/stock/adjustments', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/* ---- Archive and import ---- */

export const listArchivedProducts = () => apiRequest<ApiProduct[]>('/products?archived=1');

export const archiveProduct = (id: number, archived: boolean) =>
  apiRequest<ApiProduct>(`/products/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  });

export type ImportRow = {
  barcode?: string;
  name?: string;
  detail?: string;
  category?: string;
  unit?: string;
  price?: string;
  cost?: string;
  stock?: string;
  lot?: string;
  expiry?: string;
};

export type ImportResult = {
  row: number;
  name: string;
  barcode: string;
  status: 'ready' | 'added' | 'skipped' | 'error';
  message: string;
};

/** With dryRun the server only checks each row; without it, the good rows are added. */
export const importProducts = (rows: ImportRow[], dryRun: boolean) =>
  apiRequest<ImportResult[]>('/products/import', {
    method: 'POST',
    body: JSON.stringify({ rows, dryRun }),
  });

/* ---- Details for a newly scanned product ---- */

export type BarcodeSuggestion = {
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  strength: string | null;
  unit: string | null;
};

export type BarcodeLookupResult =
  | { status: 'in_catalog'; productId: number; name: string }
  | { status: 'found'; suggestion: BarcodeSuggestion }
  | { status: 'not_found' }
  | { status: 'unavailable' | 'invalid_barcode' };

export const lookupBarcode = (barcode: string) =>
  apiRequest<BarcodeLookupResult>(`/products/barcode-lookup/${encodeURIComponent(barcode)}`);

/** A sale as the server records it, in the shape the sales pages read. */
export type ApiSale = {
  id: number;
  receipt: string;
  date: string;
  items: number;
  subtotal: number;
  discount: number;
  total: number;
  payment: 'Cash' | 'GCash' | 'Credit' | 'No charge';
  status: 'Completed' | 'Credit' | 'Pending GCash' | 'No charge' | 'Voided';
  cashier: string;
  customer?: string;
  amountPaid: number;
  change: number;
  creditBalance: number;
  downPayment?: number;
  gcashReference?: string;
  paymentStatus?: 'Paid' | 'Unpaid';
  noChargeReason?: string;
  voidedAt?: string;
  voidReason?: string;
  lines: Array<{ product: string; barcode: string; quantity: number; unitPrice: number }>;
};

export type NewSale = {
  lines: Array<{ productId: number; quantity: number }>;
  payment: 'cash' | 'gcash' | 'credit' | 'no_charge';
  discountPercent?: number;
  amountTendered?: number;
  gcashReference?: string;
  gcashPaid?: boolean;
  customerName?: string;
  downPayment?: number;
  noChargeReason?: string;
};

/** The last 35 days plus every utang sale and pending GCash: the browser's working copy. */
export const listSales = () => apiRequest<ApiSale[]>('/sales');

/** Every sale between two dates (YYYY-MM-DD, both included; at most 400 days), for reports. */
export const listSalesBetween = (from: string, to: string) =>
  apiRequest<ApiSale[]>(`/sales?from=${from}&to=${to}`);

export const createSale = (input: NewSale) =>
  apiRequest<ApiSale>('/sales', { method: 'POST', body: JSON.stringify(input) });

export const voidSale = (id: number, reason: string) =>
  apiRequest<ApiSale>(`/sales/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });

/** One customer's utang: items bought on credit (oldest first), payments, and the balance. */
export type ApiCustomerHistory = {
  name: string;
  total: number;
  paid: number;
  balance: number;
  items: Array<{
    date: string;
    receipt: string;
    product: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  payments: Array<{
    date: string;
    kind: 'Down payment' | 'Payment';
    amount: number;
    records: string;
  }>;
};

export const getCustomerHistory = (name: string) =>
  apiRequest<ApiCustomerHistory>(`/sales/customers/history?name=${encodeURIComponent(name)}`);

/** A payment toward the customer's whole balance; the server applies it to the oldest utang first. */
export const payCustomer = (name: string, amount: number) =>
  apiRequest<ApiCustomerHistory>('/sales/customers/payments', {
    method: 'POST',
    body: JSON.stringify({ name, amount }),
  });

export const renameUtangCustomer = (from: string, to: string) =>
  apiRequest<{ moved: number }>('/sales/customers/rename', {
    method: 'PATCH',
    body: JSON.stringify({ from, to }),
  });

export type ApiExpense = {
  id: number;
  date: string;
  category: string;
  description: string;
  paymentMethod: 'Cash' | 'GCash' | 'Bank transfer' | 'Card';
  amount: number;
  recordedBy: string;
  /** Recorded as cash out of the drawer; it stays in that shift's count. */
  fromDrawer: boolean;
};

export const listExpenses = () => apiRequest<ApiExpense[]>('/expenses');

/** What a cash out can be filed under. */
export const listExpenseCategories = () => apiRequest<string[]>('/expenses/categories');

export const removeExpense = (id: number) =>
  apiRequest<void>(`/expenses/${id}`, { method: 'DELETE' });

/** One month of the owner's profit report (pesos). */
export type ApiProfitMonth = {
  month: string;
  sales: number;
  costOfGoods: number;
  freeItems: number;
  stockLosses: number;
  expenses: number;
  expensesByCategory: Record<string, number>;
  profit: number;
  cashToOwner: number;
  unitsWithoutCost: number;
};

/** The last `months` months, oldest first (owner only). */
export const getProfit = (months = 6) =>
  apiRequest<ApiProfitMonth[]>(`/reports/profit?months=${months}`);

/** The owner's monthly system subscription (Settings > Subscription). */
export type ApiBilling = {
  status: 'not_started' | 'paid' | 'pending' | 'due' | 'overdue';
  items: Array<{ label: string; amount: number }>;
  fee: number;
  startMonth: string | null;
  months: Array<{ month: string; state: 'paid' | 'pending' | 'unpaid' }>;
  unpaidMonths: string[];
  paidThrough: string | null;
  qrAvailable: boolean;
  payments: Array<{
    id: number;
    firstMonth: string;
    months: number;
    amount: number;
    reference: string;
    status: 'pending' | 'confirmed' | 'rejected';
    submittedAt: string;
    submittedBy: string;
    decidedAt: string | null;
  }>;
};

export const getBilling = () => apiRequest<ApiBilling>('/billing');

export const submitBillingPayment = (reference: string) =>
  apiRequest<{ id: number; firstMonth: string; months: number; amount: number }>(
    '/billing/payments',
    { method: 'POST', body: JSON.stringify({ reference }) },
  );
