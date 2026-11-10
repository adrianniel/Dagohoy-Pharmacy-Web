import {
  getSettings,
  listLots,
  listMovements,
  listProducts,
  listSales,
  listStaff,
  listSuppliers,
  type ApiProduct,
  type ApiSettings,
} from '../services/storeApi';
import { saveInventory, stockStatus, type InventoryProduct } from './inventoryStore';
import { saveBatches, saveMovements } from './operationsStore';
import { syncShift } from './registerSession';

/*
 * The server is the source of truth for products, stock (lots and the ledger), suppliers,
 * the staff roster and the store settings. Pages still read browser copies of them, so
 * the copies below are refreshed from the server after login and after every change.
 *
 * Sales are recorded on the server too; the copy below feeds the Transactions, Credit,
 * dashboard and report pages. When the last page reads the API directly, this file goes away.
 */

const SUPPLIERS_KEY = 'dagohoy_demo_suppliers';
const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';
const ROSTER_KEY = 'dagohoy_demo_staff_roster';
const SALES_KEY = 'dagohoy_demo_sales';
const VOID_LOG_KEY = 'dagohoy_demo_void_log';

/**
 * Recent sales (35 days, plus every utang sale and pending GCash) and the void log made from the
 * voided ones. Older months come straight from the server (Monthly sales, Transactions custom
 * range), so the browser copy stays small.
 */
export async function syncSales() {
  const sales = await listSales();
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  localStorage.setItem(
    VOID_LOG_KEY,
    JSON.stringify(
      sales
        .filter((sale) => sale.status === 'Voided')
        .map((sale) => ({
          receipt: sale.receipt,
          date: sale.voidedAt ?? sale.date,
          reason: sale.voidReason ?? '',
          cashier: sale.cashier,
          total: sale.total,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    ),
  );
  window.dispatchEvent(new Event('dagohoy-sales-synced'));
}

/** After a sale or void: the sales copy and the stock it moved. */
export async function syncAfterSale() {
  await Promise.all([syncSales(), syncCatalog(), syncStock()]);
}

/** Products from the server, in the shape the pages read. Stock comes from the ledger. */
export function mergeCatalog(server: ApiProduct[]): InventoryProduct[] {
  return server.map((item) => {
    const stock = item.onHand;
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

/** Lots and the stock ledger, in the shapes the stock pages read. */
export async function syncStock() {
  const [lots, movements] = await Promise.all([listLots(), listMovements()]);
  saveBatches(
    lots.map((lot) => ({
      id: String(lot.id),
      product: lot.product,
      barcode: lot.barcode ?? '',
      lot: lot.lot,
      expiry: lot.expiry ?? '',
      stock: lot.onHand,
      receivedAt: lot.receivedAt ?? undefined,
      unitCost: lot.unitCost ?? undefined,
      supplier: lot.supplier ?? undefined,
    })),
  );
  saveMovements(
    movements.map((movement) => ({
      id: String(movement.id),
      date: movement.date,
      product: movement.product,
      kind: movement.kind,
      change: movement.change,
      reference: movement.reference,
      staff: movement.staff,
      reason: movement.reason,
      unitCost: movement.unitCost ?? undefined,
    })),
  );
}

/** After a stock change: products (on hand) and lots and movements together. */
export async function syncAfterStockChange() {
  await Promise.all([syncCatalog(), syncStock()]);
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
  await Promise.allSettled([
    syncSettings(),
    syncCatalog(),
    syncStock(),
    syncSuppliers(),
    syncRoster(),
    syncShift(),
    syncSales(),
  ]);
}
