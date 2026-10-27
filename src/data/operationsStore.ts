export type StockMovement = {
  id: string;
  date: string;
  product: string;
  kind: 'Received' | 'Adjustment' | 'Sale' | 'Return' | 'Damaged';
  change: number;
  reference: string;
  staff: string;
  reason: string;
};

export type PurchaseOrder = {
  id: string;
  supplier: string;
  product: string;
  productBarcode: string;
  quantity: number;
  created: string;
  status: 'Draft' | 'Ordered' | 'Received';
};

export type InventoryBatch = {
  id: string;
  product: string;
  barcode: string;
  lot: string;
  expiry: string;
  stock: number;
  receivedAt?: string;
};

const MOVEMENTS_KEY = 'dagohoy_demo_stock_movements';
const ORDERS_KEY = 'dagohoy_demo_purchase_orders';
const BATCHES_KEY = 'dagohoy_demo_inventory_batches';

export function loadMovements(): StockMovement[] {
  try {
    const stored = localStorage.getItem(MOVEMENTS_KEY);
    return stored ? (JSON.parse(stored) as StockMovement[]) : [];
  } catch {
    return [];
  }
}

export function saveMovements(movements: StockMovement[]) {
  localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
}

export function loadPurchaseOrders(): PurchaseOrder[] {
  try {
    const stored = localStorage.getItem(ORDERS_KEY);
    return stored ? (JSON.parse(stored) as PurchaseOrder[]) : [];
  } catch {
    return [];
  }
}

export function savePurchaseOrders(orders: PurchaseOrder[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function loadBatches(fallback: InventoryBatch[]): InventoryBatch[] {
  try {
    const stored = localStorage.getItem(BATCHES_KEY);
    return stored ? (JSON.parse(stored) as InventoryBatch[]) : fallback;
  } catch {
    return fallback;
  }
}

export function saveBatches(batches: InventoryBatch[]) {
  localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
}
