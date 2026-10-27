import { mockProducts } from './cashierMockData';

export type InventoryProduct = (typeof mockProducts)[number] & { category?: string };
const INVENTORY_KEY = 'dagohoy_demo_inventory';

export function getInventory(): InventoryProduct[] {
  try {
    const stored = localStorage.getItem(INVENTORY_KEY);
    const products = stored ? (JSON.parse(stored) as InventoryProduct[]) : [...mockProducts];
    return products.map((product) => ({ ...product, status: stockStatus(product.stock) }));
  } catch {
    return mockProducts.map((product) => ({ ...product, status: stockStatus(product.stock) }));
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
