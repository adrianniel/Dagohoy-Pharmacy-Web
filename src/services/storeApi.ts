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

export const assignCategories = (items: Array<{ id: number; category: string }>) =>
  apiRequest<{ updated: number }>('/products/category-assignments', {
    method: 'POST',
    body: JSON.stringify({ items }),
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
