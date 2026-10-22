import { mockProducts } from './cashierMockData';

export type InventoryProduct = (typeof mockProducts)[number];
const INVENTORY_KEY = 'dagohoy_demo_inventory';

export function getInventory(): InventoryProduct[] {
  try {
    const stored = localStorage.getItem(INVENTORY_KEY);
    return stored ? (JSON.parse(stored) as InventoryProduct[]) : [...mockProducts];
  } catch {
    return [...mockProducts];
  }
}

export function saveInventory(products: InventoryProduct[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
}

export function stockStatus(stock: number): InventoryProduct['status'] {
  if (stock <= 0) return 'Out of Stock';
  if (stock < 20) return 'Low Stock';
  return 'In Stock';
}
