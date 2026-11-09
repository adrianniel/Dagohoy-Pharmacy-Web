import {
  getSettings,
  listProducts,
  listStaff,
  listSuppliers,
  type ApiProduct,
  type ApiSettings,
} from '../services/storeApi';
import { getInventory, saveInventory, stockStatus, type InventoryProduct } from './inventoryStore';

/*
 * The server is the source of truth for products, suppliers, the staff roster and the
 * store settings. Pages not moved to the API yet (POS, stock, reports) still read the
 * browser copies below, so they are refreshed from the server after login and after
 * every change.
 *
 * shortcut: stock counts stay in the browser copy until Phase 4 (stock) and Phase 6
 * (sales) move them to the server; then this file goes away.
 */

const SUPPLIERS_KEY = 'dagohoy_demo_suppliers';
const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';
const ROSTER_KEY = 'dagohoy_demo_staff_roster';

/** Products from the server, with the stock the browser already tracks for each one. */
export function mergeCatalog(
  server: ApiProduct[],
  local: InventoryProduct[] = getInventory(),
): InventoryProduct[] {
  return server.map((item) => {
    const mine =
      local.find((product) => product.id === item.id) ??
      local.find((product) => !product.id && product.barcode === item.barcode);
    const stock = mine ? mine.stock : item.onHand;
    return {
      id: item.id,
      barcode: item.barcode ?? '',
      product: item.name,
      detail: item.detail,
      unit: item.unit,
      price: `₱${(item.price ?? 0).toFixed(2)}`,
      cost: item.cost ?? undefined,
      category: item.category ?? undefined,
      stock,
      status: stockStatus(stock),
    };
  });
}

export async function syncCatalog() {
  saveInventory(mergeCatalog(await listProducts()));
  window.dispatchEvent(new Event('dagohoy-catalog-synced'));
}

export async function syncSuppliers() {
  const suppliers = await listSuppliers();
  localStorage.setItem(
    SUPPLIERS_KEY,
    JSON.stringify(
      suppliers.map(({ id, name, contact, status }) => ({
        id,
        name,
        contact,
        status,
        products: 0,
      })),
    ),
  );
}

export async function syncRoster() {
  const staff = await listStaff();
  localStorage.setItem(
    ROSTER_KEY,
    JSON.stringify(staff.map((member) => ({ ...member, id: String(member.id) }))),
  );
}

/** Settings in the shape the receipt, POS and stock pages already read. */
export function cacheSettings(settings: ApiSettings) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      name: settings.name,
      phone: settings.phone,
      address: settings.address,
      email: settings.email,
      businessHours: settings.businessHours,
      threshold: String(settings.lowStockThreshold),
      gcashNumber: settings.gcashNumber,
      gcashQrUrl: settings.gcashQrUrl,
    }),
  );
  window.dispatchEvent(new Event('pharmacy-settings-changed'));
}

export async function syncSettings() {
  cacheSettings(await getSettings());
}

/** Everything at once, after the login check. A failed part keeps its old copy. */
export async function syncFromServer() {
  await Promise.allSettled([syncSettings(), syncCatalog(), syncSuppliers(), syncRoster()]);
}
