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

/** Today plus some days, as a local YYYY-MM-DD date. */
const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
};

/** Starting batch lots, used until real lots are received. */
export const initialBatches: InventoryBatch[] = [
  {
    id: 'B-10248',
    product: 'Biogesic 500mg',
    barcode: '4800016642012',
    lot: 'BGC-240811',
    expiry: plusDays(23),
    stock: 40,
  },
  {
    id: 'B-10221',
    product: 'Neozep Forte',
    barcode: '4806516731010',
    lot: 'NZF-240405',
    expiry: plusDays(68),
    stock: 19,
  },
  {
    id: 'B-10184',
    product: 'Bioflu',
    barcode: '4800361412025',
    lot: 'BIO-231206',
    expiry: plusDays(148),
    stock: 12,
  },
  {
    id: 'B-10172',
    product: 'Tuseran Forte',
    barcode: '4800016021060',
    lot: 'TSF-240210',
    expiry: plusDays(320),
    stock: 30,
  },
];
