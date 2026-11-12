/*
 * The product list and its stock. Starts empty: products are added with New product,
 * and stock arrives through Receive stock.
 */

export type InventoryProduct = {
  /** Server id. Missing only on products made before the server held the catalog. */
  id?: number;
  barcode: string;
  product: string;
  /** Generic / brand, e.g. "Paracetamol / Unilab". */
  detail: string;
  /** What one piece is sold as: Tablet, Capsule, Bottle… */
  unit: string;
  /** Selling price as shown, e.g. "₱5.50". */
  price: string;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  category?: string;
  /** Latest cost per unit paid to the supplier (from Receive stock or the product form). */
  cost?: number;
  /** Scanned and sold at the Sales Counter before it was added; waits for Register. */
  unregistered?: boolean;
  /** No barcode of its own (code NB-000123): found by name. */
  noBarcode?: boolean;
};

const INVENTORY_KEY = 'dagohoy_demo_inventory';

export function getInventory(): InventoryProduct[] {
  try {
    const stored = JSON.parse(localStorage.getItem(INVENTORY_KEY) ?? '[]') as InventoryProduct[];
    return stored.map((product) => ({ ...product, status: stockStatus(product.stock) }));
  } catch {
    return [];
  }
}
export function saveInventory(products: InventoryProduct[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
}

export function stockStatus(stock: number): InventoryProduct['status'] {
  const threshold = getLowStockThreshold();
  if (stock <= 0) return 'Out of Stock';
  if (stock < threshold) return 'Low Stock';
  return 'In Stock';
}

export function getLowStockThreshold(): number {
  try {
    const settings = JSON.parse(
      localStorage.getItem('dagohoy_demo_pharmacy_settings') ?? 'null',
    ) as { threshold?: string } | null;
    const value = Number(settings?.threshold);
    return Number.isFinite(value) && value > 0 ? value : 15;
  } catch {
    return 15;
  }
}
