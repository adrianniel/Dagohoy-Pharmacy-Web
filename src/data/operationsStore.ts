export type StockMovement = {
  id: string;
  date: string;
  product: string;
  /**
   * Return = sent back to the supplier (stock goes out).
   * Customer return = a customer brought an item back to the shelf (stock comes in).
   */
  kind: 'Received' | 'Adjustment' | 'Sale' | 'Return' | 'Damaged' | 'Customer return';
  change: number;
  reference: string;
  staff: string;
  reason: string;
  /** Cost per unit paid to the supplier, on Received movements. */
  unitCost?: number;
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
  /** Cost per unit paid to the supplier for this lot. */
  unitCost?: number;
  supplier?: string;
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

/** Lots used before any are saved: none. Lots come from Receive stock and New product. */
export const initialBatches: InventoryBatch[] = [];
