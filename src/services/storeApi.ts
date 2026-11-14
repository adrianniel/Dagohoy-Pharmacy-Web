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
  /** Sold at the Sales Counter before it was on the product list; waits for Register. */
  unregistered?: boolean;
  /** Has no barcode of its own (its code is NB-000123); found by name. */
  noBarcode?: boolean;
};

export type ProductInput = {
  name: string;
  barcode: string;
  detail: string;
  category: string;
  unit: string;
  /** Null: no selling price yet (the product waits under Needs price). */
  price: number | null;
  cost?: number | null;
  /** Batch and expiry may be empty for items that have none. */
  opening?: { quantity: number; lot?: string; expiry?: string };
  /** Scanned and sold at the Sales Counter before it is registered. */
  unregistered?: boolean;
  /** No barcode: the server gives it its own code (NB-000123). */
  noBarcode?: boolean;
};

export const listProducts = () => apiRequest<ApiProduct[]>('/products');

export const createProduct = (input: ProductInput) =>
  apiRequest<ApiProduct>('/products', { method: 'POST', body: JSON.stringify(input) });

export const updateProduct = (id: number, changes: Partial<Omit<ProductInput, 'opening'>>) =>
  apiRequest<ApiProduct>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });

/** Fills in the rest of a product sold before it was registered; the stock becomes `opening`. */
export const registerProduct = (id: number, input: Partial<ProductInput>) =>
  apiRequest<ApiProduct>(`/products/${id}/register`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

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
  /** The weekly hours (Monday first); null when never set in Settings. */
  openingHours?: ApiDayHours[] | null;
  lowStockThreshold: number;
  gcashNumber: string;
  gcashQrUrl: string;
};

/** One day of the week: 0 = Sunday … 6 = Saturday; no times = closed. */
export type ApiDayHours = {
  day: number;
  label: string;
  opensAt: string | null;
  closesAt: string | null;
};

export const getSettings = () => apiRequest<ApiSettings>('/settings');

export const saveSettings = (
  settings: Omit<ApiSettings, 'openingHours'> & {
    openingHours?: Array<Pick<ApiDayHours, 'day' | 'opensAt' | 'closesAt'>>;
  },
) => apiRequest<ApiSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) });

/** What the landing page shows: no login needed. */
export type ApiPublicSettings = Pick<ApiSettings, 'name' | 'address' | 'phone' | 'email'> & {
  openingHours: ApiDayHours[] | null;
};

export const getPublicSettings = () => apiRequest<ApiPublicSettings>('/settings/public');

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
  /** This batch's own selling price; null: it sells at the product's price. */
  sellingPrice: number | null;
  supplier: string | null;
};

/** A batch's own cost and selling price. Left out: unchanged; null: cleared. */
export const setLotPrices = (
  batchId: number,
  input: { unitCost?: number | null; sellingPrice?: number | null },
) =>
  apiRequest<ApiLot>(`/stock/lots/${batchId}/prices`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

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
  /** Leave out when the cost is not known yet. */
  unitCost?: number;
  /** Empty: its own TBD- batch (NO-BATCH for an item without a barcode). */
  lot?: string;
  /** Empty: the item does not expire. */
  expiry?: string;
  supplier?: string;
  reference?: string;
  sellingPrice?: number;
}) =>
  apiRequest<{ batchId: number; onHand: number }>('/stock/receive', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/** Needs details: the batch number (and expiry) of stock received without one. */
export const fillLotDetails = (batchId: number, input: { lot: string; expiry?: string }) =>
  apiRequest<{ batchId: number }>(`/stock/lots/${batchId}/details`, {
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

/** Several items in one save (a supplier return of many items): all saved, or none. */
export const adjustStockMany = (items: Array<Parameters<typeof adjustStock>[0]>) =>
  apiRequest<{ saved: number }>('/stock/adjustments/batch', {
    method: 'POST',
    body: JSON.stringify({ items }),
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
  | { status: 'unavailable' | 'invalid_barcode' | 'paused' };

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
  /** Peso amount off the whole sale (typed by the cashier). */
  discountAmount?: number;
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
  status: 'trial' | 'not_started' | 'paid' | 'pending' | 'upcoming' | 'due' | 'overdue';
  /** Free new-product scans before billing starts. */
  freeScans: { total: number; used: number; left: number; ranOutAt: string | null };
  fee: number;
  startMonth: string | null;
  months: Array<{ month: string; state: 'paid' | 'pending' | 'unpaid' }>;
  unpaidMonths: string[];
  paidThrough: string | null;
  /** Day of the month each payment is due (older servers leave it out: the 1st). */
  dueDay?: number;
  dueDate: string | null;
  pauseDate: string | null;
  lookupActive: boolean;
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
