import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { MonthlySalesReport } from '../../components/admin/MonthlySalesReport';
import { StockControlCenter } from '../../components/admin/StockControlCenter';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { HourlyBars } from '../../components/HourlyBars';
import { formatHour, hourRange } from '../../components/hours';
import { ScanInput } from '../../components/ScanInput';
import { useToast } from '../../components/toast';
import {
  getInventory,
  getLowStockThreshold,
  InventoryProduct,
  stockStatus,
} from '../../data/inventoryStore';
import { initialBatches, loadBatches } from '../../data/operationsStore';
import { suggestProductCategories } from '../../services/productsApi';
import {
  archiveProduct,
  assignCategories,
  createProduct,
  lookupBarcode,
  createSupplier,
  saveSettings as saveStoreSettings,
  updateProduct,
} from '../../services/storeApi';
import {
  cacheSettings,
  syncAfterStockChange,
  syncCatalog,
  syncSuppliers,
} from '../../data/serverSync';
import { ArchivedProducts } from '../../components/admin/ArchivedProducts';
import { ProductImport } from '../../components/admin/ProductImport';
import { getCurrentAccount } from '../../data/accountStore';
import { StaffAccounts } from './StaffAccounts';

type AdminSection = 'dashboard' | 'products' | 'suppliers' | 'reports' | 'staff' | 'settings';
type SupplierTab = 'list' | 'add';
type SettingsTab = 'details' | 'alerts' | 'gcash';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
type Supplier = { name: string; contact: string; products?: number; status: string };
const suppliers: Supplier[] = [];

type SavedSale = {
  receipt: string;
  date: string;
  total?: number;
  payment?: string;
  status?: string;
  creditBalance?: number;
  lines?: Array<{ product: string; barcode?: string; quantity: number; unitPrice: number }>;
};

/** Sales that count as sales: not voided and not a no-charge slip. */
function readCountedSales(): SavedSale[] {
  try {
    const sales = JSON.parse(localStorage.getItem('dagohoy_demo_sales') ?? '[]') as SavedSale[];
    return sales.filter((sale) => sale.status !== 'Voided' && sale.payment !== 'No charge');
  } catch {
    return [];
  }
}
const SUPPLIER_KEY = 'dagohoy_demo_suppliers';
const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';
type PharmacySettings = {
  name: string;
  phone: string;
  address: string;
  email?: string;
  businessHours?: string;
  threshold: string;
  gcashNumber?: string;
  gcashQrUrl?: string;
};
const defaultSettings: PharmacySettings = {
  name: 'Dagohoy Pharmacy',
  phone: '',
  address: '',
  email: '',
  businessHours: 'Mon–Sat 8:00 AM–8:00 PM · Sun 9:00 AM–6:00 PM',
  threshold: '15',
};
/** How many lots were received from a supplier (Receive stock saves the supplier on the lot). */
function supplierLots(name: string) {
  return loadBatches(initialBatches).filter((batch) => batch.supplier === name).length;
}
function loadLocalList<T>(key: string, initial: T[]): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? initial;
  } catch {
    return initial;
  }
}
function loadLocalValue<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

export function AdminPage({ section }: { section: AdminSection }) {
  const [query, setQuery] = useState('');
  /** Barcode scanned in the list search that matched no product: prefilled in New product. */
  const [newBarcode, setNewBarcode] = useState('');
  const [products, setProducts] = useState(getInventory);
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [supplierList, setSupplierList] = useState<Supplier[]>(() =>
    loadLocalList(SUPPLIER_KEY, suppliers),
  );
  const [supplierTab, setSupplierTab] = useState<SupplierTab>('list');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('details');
  const { showToast } = useToast();
  const [pharmacySettings, setPharmacySettings] = useState<PharmacySettings>(() =>
    loadLocalValue(SETTINGS_KEY, defaultSettings),
  );
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const isAdmin = getCurrentAccount()?.role === 'ADMIN';

  /** Reloads products, lots and movements from the server after a bulk change. */
  async function reloadCatalog() {
    await syncAfterStockChange();
    setProducts(getInventory());
  }
  const restockThreshold =
    Number(pharmacySettings.threshold) > 0
      ? Number(pharmacySettings.threshold)
      : getLowStockThreshold();
  const restockProducts = useMemo(
    () => products.filter((product) => product.stock < restockThreshold),
    [products, restockThreshold],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.product} ${product.detail} ${product.barcode}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [products, query],
  );
  async function categorizeProducts() {
    setIsCategorizing(true);
    try {
      const suggestions = await suggestProductCategories(
        products.map((product) => ({
          id: product.barcode,
          name: product.product,
          detail: product.detail,
        })),
      );
      const categoryById = new Map(suggestions.map(({ id, category }) => [id, category]));
      const items = products.flatMap((product) => {
        const category = categoryById.get(product.barcode);
        return product.id && category ? [{ id: product.id, category }] : [];
      });
      if (items.length) await assignCategories(items);
      await syncCatalog();
      setProducts(getInventory());
      showToast(`${items.length} category suggestions applied. Please review them.`, 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not suggest categories.', 'error');
    } finally {
      setIsCategorizing(false);
    }
  }

  function downloadRestockCsv() {
    const rows = [
      ['Product', 'Barcode', 'Category', 'Current stock', 'Reorder point', 'Suggested quantity'],
      ...restockProducts.map((product) => [
        product.product,
        product.barcode,
        product.category ?? 'Uncategorized',
        String(product.stock),
        String(restockThreshold),
        String(Math.max(restockThreshold * 2 - product.stock, restockThreshold)),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dagohoy-restock-order-basis.csv';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Restock order basis downloaded. Confirm quantities with your supplier.');
  }

  const supplierItems: Array<ControlItem<SupplierTab>> = [
    {
      key: 'list',
      icon: 'suppliers',
      title: 'Supplier list',
      hint: 'Who supplies the stock',
      tone: 'forest',
      count: supplierList.length,
    },
    {
      key: 'add',
      icon: 'purchases',
      title: 'Add supplier',
      hint: 'Save a new supplier',
      tone: 'blue',
    },
  ];

  const settingsItems: Array<ControlItem<SettingsTab>> = [
    {
      key: 'details',
      icon: 'store',
      title: 'Pharmacy details',
      hint: 'Name, contact, hours',
      tone: 'forest',
      about:
        'Shown on sales records and the public page. Keep the name, number and address correct.',
    },
    {
      key: 'alerts',
      icon: 'inventory',
      title: 'Stock alerts',
      hint: `Low stock below ${pharmacySettings.threshold || '—'}`,
      tone: 'amber',
      about: 'A product is marked low stock when its count drops below this number.',
    },
    {
      key: 'gcash',
      icon: 'phone',
      title: 'GCash payment',
      hint: pharmacySettings.gcashNumber ? 'Number is set' : 'Number not set',
      tone: 'blue',
      alert: !pharmacySettings.gcashNumber,
      about: 'The GCash number and QR the cashier shows the customer at checkout.',
    },
  ];

  async function saveSettings() {
    try {
      const saved = await saveStoreSettings({
        name: pharmacySettings.name,
        address: pharmacySettings.address,
        phone: pharmacySettings.phone,
        email: pharmacySettings.email ?? '',
        businessHours: pharmacySettings.businessHours ?? '',
        lowStockThreshold: Number(pharmacySettings.threshold),
        gcashNumber: pharmacySettings.gcashNumber ?? '',
        gcashQrUrl: pharmacySettings.gcashQrUrl ?? '',
      });
      cacheSettings(saved);
      setPharmacySettings(loadLocalValue(SETTINGS_KEY, defaultSettings));
      showToast('Settings saved.');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Could not save the settings.', 'error');
    }
  }

  if (section === 'dashboard') return <AdminDashboard />;

  return (
    <div className="cashier-page">
      {section === 'products' && (
        <>
          <StockControlCenter
            products={products}
            threshold={restockThreshold}
            restockCount={restockProducts.length}
            onOrderRestock={downloadRestockCsv}
            onStockChanged={() => setProducts(getInventory())}
          >
            <section className="cashier-panel cashier-list-panel">
              <div className="cashier-list-toolbar">
                <div className="cashier-search-field cashier-search-field--wide">
                  <CashierIcon name="search" />
                  <ScanInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search a name, generic, brand, or scan the barcode"
                    inputProps={{ 'aria-label': 'Search or scan a product' }}
                    onEnter={(code) => {
                      // A scanned barcode opens that product, or New product when it is new.
                      const found = products.find((item) => item.barcode === code);
                      if (found) {
                        setEditing(found);
                        setFormOpen(true);
                      } else if (/^\d{6,}$/.test(code)) {
                        setEditing(null);
                        setNewBarcode(code);
                        setFormOpen(true);
                        showToast('New barcode. Fill in the product details.', 'info');
                      }
                    }}
                  />
                </div>
                <button
                  className="cashier-primary-action"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setNewBarcode('');
                    setFormOpen(true);
                  }}
                >
                  Add product <span>＋</span>
                </button>
                {products.length > 0 && (
                  <button
                    className="cashier-view-button"
                    type="button"
                    disabled={isCategorizing}
                    onClick={() => void categorizeProducts()}
                  >
                    {isCategorizing ? 'Suggesting…' : 'AI suggest categories'}
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button
                      className="cashier-view-button"
                      type="button"
                      onClick={() => setImportOpen(true)}
                    >
                      Import from Excel / CSV
                    </button>
                    <button
                      className="cashier-view-button"
                      type="button"
                      aria-pressed={showArchived}
                      onClick={() => setShowArchived((value) => !value)}
                    >
                      {showArchived ? 'Back to product list' : 'Archived products'}
                    </button>
                  </>
                )}
              </div>
              {showArchived ? (
                <ArchivedProducts onRestored={reloadCatalog} />
              ) : (
                <div
                  className="cashier-table-wrap"
                  role="region"
                  aria-label="Products table"
                  tabIndex={0}
                >
                  <table className="cashier-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Category / brand</th>
                        <th>Unit price</th>
                        <th>On hand</th>
                        <th>Status</th>
                        <th>Manage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.barcode}>
                          <td>
                            <strong>{product.product}</strong>
                          </td>
                          <td className="cashier-mono">{product.barcode}</td>
                          <td className="product-category-cell">
                            <strong>{product.category ?? 'Uncategorized'}</strong>
                            <small>{product.detail}</small>
                          </td>
                          <td>
                            <strong>{product.price}</strong>
                          </td>
                          <td>{product.stock}</td>
                          <td>
                            <StatusBadge value={product.status} />
                          </td>
                          <td>
                            <button
                              className="cashier-view-button"
                              type="button"
                              onClick={() => {
                                setEditing(product);
                                setFormOpen(true);
                              }}
                            >
                              Edit / stock
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="cashier-table-footer">
                <span>
                  Showing {filteredProducts.length} of {products.length} product
                  {products.length === 1 ? '' : 's'}
                </span>
              </div>
            </section>
          </StockControlCenter>
          {importOpen && (
            <ProductImport onClose={() => setImportOpen(false)} onImported={reloadCatalog} />
          )}
          {formOpen && (
            <InventoryForm
              product={editing}
              products={products}
              initialBarcode={newBarcode}
              onClose={() => setFormOpen(false)}
              onArchive={
                isAdmin && editing?.id
                  ? async () => {
                      try {
                        await archiveProduct(editing.id!, true);
                        await reloadCatalog();
                      } catch (caught) {
                        return caught instanceof Error ? caught.message : 'Could not archive it.';
                      }
                      setFormOpen(false);
                      showToast(`${editing.product} archived. Find it under Archived products.`);
                      return null;
                    }
                  : undefined
              }
              onSave={async (product, opening) => {
                // The server checks everything (barcode taken, price, unit) and saves it.
                const fields = {
                  name: product.product,
                  barcode: product.barcode,
                  detail: product.detail,
                  category: product.category ?? 'Other',
                  unit: product.unit,
                  price: Number(product.price.replace(/[₱,]/g, '')),
                  cost: product.cost ?? null,
                };
                try {
                  if (editing?.id) {
                    await updateProduct(editing.id, fields);
                  } else {
                    await createProduct(
                      opening && product.stock > 0
                        ? { ...fields, opening: { quantity: product.stock, ...opening } }
                        : fields,
                    );
                  }
                  // The opening lot and its ledger entry are made by the server.
                  await syncAfterStockChange();
                } catch (caught) {
                  return caught instanceof Error ? caught.message : 'Could not save the product.';
                }
                setProducts(getInventory());
                setFormOpen(false);
                showToast(`${product.product} saved.`);
                return null;
              }}
            />
          )}
        </>
      )}
      {section === 'suppliers' && (
        <>
          <ControlDeck
            id="suppliers"
            title="Suppliers"
            subtitle="Pick a task. Its tools open in the card below."
            active={supplierTab}
            onSelect={setSupplierTab}
            items={supplierItems}
          />
          {supplierTab === 'list' && (
            <ControlPanel
              id="suppliers"
              activeKey="list"
              title="Supplier list"
              about="Everyone the pharmacy buys stock from."
            >
              <section className="cashier-panel cashier-list-panel">
                <div
                  className="cashier-table-wrap"
                  role="region"
                  aria-label="Suppliers table"
                  tabIndex={0}
                >
                  <table className="cashier-table">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Location</th>
                        <th>Products supplied</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierList.map((supplier) => (
                        <tr key={supplier.name}>
                          <td>
                            <strong>{supplier.name}</strong>
                          </td>
                          <td>{supplier.contact}</td>
                          <td>{supplierLots(supplier.name)} lots received</td>
                          <td>
                            <StatusBadge value={supplier.status} />
                          </td>
                          <td>
                            <button
                              className="cashier-view-button"
                              type="button"
                              onClick={() =>
                                showToast(
                                  `${supplier.name} · ${supplier.contact || 'No location'} · ${supplierLots(supplier.name)} lots received`,
                                  'info',
                                )
                              }
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="cashier-table-footer">
                  <span>{supplierList.length} supplier records</span>
                </div>
              </section>
            </ControlPanel>
          )}
          {supplierTab === 'add' && (
            <ControlPanel
              id="suppliers"
              activeKey="add"
              title="Add supplier"
              about="Save a new supplier so you can pick it when stock is delivered."
            >
              <SupplierForm
                onCancel={() => setSupplierTab('list')}
                onSave={async (value) => {
                  try {
                    await createSupplier({ name: value.name, contact: value.contact });
                    await syncSuppliers();
                  } catch (caught) {
                    return caught instanceof Error
                      ? caught.message
                      : 'Could not save the supplier.';
                  }
                  setSupplierList(loadLocalList(SUPPLIER_KEY, suppliers));
                  setSupplierTab('list');
                  showToast('Supplier saved.');
                  return null;
                }}
              />
            </ControlPanel>
          )}
        </>
      )}{' '}
      {section === 'reports' && <Reports />}
      {section === 'staff' && <StaffAccounts />}
      {section === 'settings' && (
        <>
          <ControlDeck
            id="settings"
            title="Settings"
            subtitle="Pick what to change. Save keeps every setting at once."
            active={settingsTab}
            onSelect={setSettingsTab}
            items={settingsItems}
          />
          <ControlPanel
            id="settings"
            activeKey={settingsTab}
            title={settingsItems.find((item) => item.key === settingsTab)?.title ?? 'Settings'}
            about={settingsItems.find((item) => item.key === settingsTab)?.about}
            actions={
              <button
                className="cashier-primary-action"
                type="button"
                onClick={() => void saveSettings()}
              >
                Save changes
              </button>
            }
          >
            <section className="cashier-panel settings-form">
              {settingsTab === 'details' && (
                <>
                  <label>
                    Pharmacy name
                    <input
                      value={pharmacySettings.name}
                      onChange={(event) =>
                        setPharmacySettings({ ...pharmacySettings, name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Contact number
                    <input
                      value={pharmacySettings.phone}
                      onChange={(event) =>
                        setPharmacySettings({ ...pharmacySettings, phone: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Address
                    <input
                      value={pharmacySettings.address}
                      onChange={(event) =>
                        setPharmacySettings({ ...pharmacySettings, address: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={pharmacySettings.email ?? ''}
                      onChange={(event) =>
                        setPharmacySettings({ ...pharmacySettings, email: event.target.value })
                      }
                      placeholder="Pharmacy email address"
                    />
                  </label>
                  <label>
                    Business hours
                    <input
                      value={pharmacySettings.businessHours ?? ''}
                      onChange={(event) =>
                        setPharmacySettings({
                          ...pharmacySettings,
                          businessHours: event.target.value,
                        })
                      }
                      placeholder="Mon–Sat 8:00 AM–8:00 PM · Sun 9:00 AM–6:00 PM"
                    />
                  </label>
                </>
              )}
              {settingsTab === 'alerts' && (
                <label>
                  Low-stock alert threshold
                  <input
                    type="number"
                    min="1"
                    value={pharmacySettings.threshold}
                    onChange={(event) =>
                      setPharmacySettings({ ...pharmacySettings, threshold: event.target.value })
                    }
                  />
                </label>
              )}
              {settingsTab === 'gcash' && (
                <>
                  <p className="demo-note">
                    These details are displayed to the cashier at checkout. No payment is processed
                    by this app.
                  </p>
                  <label>
                    GCash number
                    <input
                      inputMode="tel"
                      value={pharmacySettings.gcashNumber ?? ''}
                      onChange={(event) =>
                        setPharmacySettings({
                          ...pharmacySettings,
                          gcashNumber: event.target.value,
                        })
                      }
                      placeholder="09XX XXX XXXX"
                    />
                  </label>
                  <label>
                    GCash QR image URL
                    <input
                      type="url"
                      value={pharmacySettings.gcashQrUrl ?? ''}
                      onChange={(event) =>
                        setPharmacySettings({ ...pharmacySettings, gcashQrUrl: event.target.value })
                      }
                      placeholder="https://…"
                    />
                  </label>
                </>
              )}
            </section>
          </ControlPanel>
        </>
      )}{' '}
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="cashier-summary-card" title={`${label}: ${value} — ${detail}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

/** Add-supplier form, shown inside the Add supplier card. */
function SupplierForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  /** Resolves to an error message, or null when saved. */
  onSave: (value: Supplier) => Promise<string | null>;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="cashier-panel settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const problem = await onSave({
          name: name.trim(),
          contact: contact.trim(),
          products: 0,
          status: 'Active',
        });
        setSaving(false);
        setError(problem ?? '');
      }}
    >
      <label>
        Supplier name
        <input
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Unilab, Inc."
        />
      </label>
      <label>
        Phone, email, or location
        <input
          required
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="e.g. 0917 123 4567 · Tagbilaran City"
        />
      </label>
      {error && (
        <p className="pos-notice" role="alert">
          {error}
        </p>
      )}
      <div className="stock-index__actions">
        <button className="cashier-primary-action" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save supplier'}
        </button>
        <button className="cashier-view-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
const UNITS = ['Tablet', 'Capsule', 'Sachet', 'Bottle', 'Tube', 'Pack', 'Box', 'Piece'];
const COMMON_CATEGORIES = [
  'Pain & fever',
  'Cough & cold',
  'Vitamins & supplements',
  'Antibiotics (Rx)',
  'Maintenance (Rx)',
  'Stomach & digestion',
  'Allergy',
  'First aid',
  'Personal care',
  'Other',
];
const MARKUPS = [20, 30, 50];

const peso = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

/**
 * Add or edit a product: what it is, what it costs, what it sells for, and (for a new
 * product) the stock already on the shelf with its lot and expiry. Stock of an existing
 * product is changed through Receive stock or Adjustments so every change is recorded.
 */
function InventoryForm({
  product,
  products,
  initialBarcode = '',
  onClose,
  onSave,
  onArchive,
}: {
  product: InventoryProduct | null;
  products: InventoryProduct[];
  initialBarcode?: string;
  onClose: () => void;
  /** Archives the product (owner/admin only). Resolves to an error message, or null. */
  onArchive?: () => Promise<string | null>;
  /** Saves on the server. Resolves to an error message, or null when saved. */
  onSave: (
    product: InventoryProduct,
    opening?: { lot: string; expiry: string },
  ) => Promise<string | null>;
}) {
  const isNew = !product;
  const [name, setName] = useState(product?.product ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode);
  const [detail, setDetail] = useState(product?.detail ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'Tablet');
  const [cost, setCost] = useState(product?.cost ? String(product.cost) : '');
  const [price, setPrice] = useState(product ? product.price.replace(/[₱,]/g, '') : '');
  const [stock, setStock] = useState('');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /** What the barcode lookup found (or why not), shown under the barcode field. */
  const [lookupNote, setLookupNote] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');

  /**
   * New product only: asks the server about a scanned barcode (our catalog, saved answers,
   * then BarCloud) and fills the fields that are still empty. The user checks them.
   */
  async function fillFromBarcode(code: string) {
    if (!isNew || !/^\d{8,14}$/.test(code)) return;
    setLookupNote(
      'Looking up this barcode… A product new to the database can take up to 20 seconds.',
    );
    setLookupState('loading');
    try {
      const result = await lookupBarcode(code);
      if (result.status === 'found') {
        const found = result.suggestion;
        setName((current) => current || found.name);
        setDetail((current) => current || found.brand || '');
        setCategory((current) => current || found.category || '');
        if (found.unit && UNITS.includes(found.unit)) setUnit(found.unit);
        setLookupState('found');
        setLookupNote(
          `Filled from ${result.source === 'cache' ? 'a saved lookup' : 'BarCloud'}${
            found.strength ? ` (strength ${found.strength})` : ''
          }. Check the name and add the generic name before saving.`,
        );
      } else if (result.status === 'in_catalog') {
        setLookupNote('');
        setError(`Barcode ${code} is already used by ${result.name}.`);
      } else if (result.status === 'not_found') {
        setLookupState('missing');
        setLookupNote('Not in the barcode database. Type the details.');
      } else if (result.status === 'limit_reached') {
        setLookupState('missing');
        setLookupNote("Today's barcode lookup limit is reached. Type the details.");
      } else if (result.status === 'disabled') {
        setLookupState('missing');
        setLookupNote(
          'Barcode lookup is off: the BarCloud key is not set on the server yet. Type the details.',
        );
      } else if (result.status === 'unavailable') {
        setLookupState('missing');
        setLookupNote('The barcode service did not answer. Type the details, or try again later.');
      } else {
        setLookupNote('');
      }
    } catch {
      setLookupState('missing');
      setLookupNote('Could not reach the server for the barcode lookup. Type the details.');
    }
  }

  /** The last barcode checked, so the same code is never looked up twice. */
  const checkedBarcode = useRef('');

  function checkBarcode(code: string) {
    if (!isNew || code === checkedBarcode.current) return;
    checkedBarcode.current = code;
    const owner = products.find((item) => item.barcode === code);
    if (owner) {
      setLookupNote('');
      setError(`Barcode ${code} is already used by ${owner.product}.`);
      return;
    }
    void fillFromBarcode(code);
  }

  // Scanners type the whole code at once, and some never press Enter: once the field holds a
  // full barcode and stops changing for a moment, look it up. This also covers a barcode
  // scanned in the product list, which opens this form with it.
  useEffect(() => {
    const code = barcode.trim();
    if (!isNew || !/^\d{8,14}$/.test(code)) return;
    const timer = window.setTimeout(() => checkBarcode(code), 350);
    return () => window.clearTimeout(timer);
  }, [barcode]);

  const costValue = Number(cost);
  const priceValue = Number(price);
  const hasCost = cost.trim() !== '' && costValue > 0;
  const hasPrice = price.trim() !== '' && priceValue > 0;
  const profit = hasCost && hasPrice ? priceValue - costValue : null;
  const markup = profit !== null ? (profit / costValue) * 100 : null;
  const openingQty = Math.max(0, Math.floor(Number(stock) || 0));
  const categories = [
    ...new Set([
      ...COMMON_CATEGORIES,
      ...products.map((item) => item.category).filter((value): value is string => !!value),
    ]),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim() || !barcode.trim() || !detail.trim()) {
      setError('Fill in the product name, barcode and generic / brand.');
      return;
    }
    if (!hasPrice) {
      setError('Enter the selling price.');
      return;
    }
    if (cost.trim() !== '' && !hasCost) {
      setError('The cost must be above ₱0, or leave it blank if you do not know it yet.');
      return;
    }
    if (isNew && openingQty > 0) {
      if (!lot.trim()) {
        setError('Enter the lot number of the stock you are adding.');
        return;
      }
      if (!expiry) {
        setError('Enter the expiry date of the stock you are adding.');
        return;
      }
    }
    const quantity = isNew ? openingQty : product.stock;
    setSaving(true);
    const problem = await onSave(
      {
        ...(product ?? {}),
        barcode: barcode.trim(),
        product: name.trim(),
        detail: detail.trim(),
        category: category.trim() || 'Other',
        unit,
        price: `₱${priceValue.toFixed(2)}`,
        cost: hasCost ? Math.round(costValue * 100) / 100 : product?.cost,
        stock: quantity,
        status: stockStatus(quantity),
      },
      isNew && openingQty > 0 ? { lot: lot.trim().toUpperCase(), expiry } : undefined,
    );
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <div
      className="pos-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="pos-payment-modal inventory-form product-form" onSubmit={submit} noValidate>
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close product form"
        >
          ×
        </button>
        <p className="eyebrow">Products &amp; Stock</p>
        <h2>{isNew ? 'New product' : `Edit ${product.product}`}</h2>
        <p className="inventory-form-note">
          {isNew
            ? 'For a medicine or item that is not in the list yet.'
            : 'Change the details and prices.'}
        </p>

        <fieldset className="product-form__section">
          <legend>1. {isNew ? 'Scan the barcode' : 'Barcode'}</legend>
          <div className={`product-form__scan is-${lookupState}`}>
            <ScanInput
              value={barcode}
              onChange={(next) => {
                setBarcode(next);
                setError('');
                if (next.trim() !== checkedBarcode.current) {
                  setLookupNote('');
                  setLookupState('idle');
                }
              }}
              onEnter={(code) => {
                const owner = products.find(
                  (item) => item.barcode === code && item.barcode !== product?.barcode,
                );
                if (owner) setError(`Barcode ${code} is already used by ${owner.product}.`);
                else checkBarcode(code);
              }}
              placeholder={isNew ? 'Scan the product barcode' : 'Scan or type it'}
              inputProps={{ inputMode: 'numeric', autoFocus: isNew, 'aria-label': 'Barcode' }}
            />
            <p className="product-form__lookup" aria-live="polite">
              {lookupNote ||
                (isNew
                  ? 'Scan it and the name, brand and category fill in by themselves. No barcode? Type a code of your own.'
                  : 'Change it only if the product has a new barcode.')}
            </p>
          </div>
        </fieldset>

        <fieldset className="product-form__section">
          <legend>2. What it is</legend>
          <div className="product-form__grid">
            <label className="product-form__wide">
              Product name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Biogesic 500mg"
              />
            </label>
            <label>
              Generic / brand
              <input
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="e.g. Paracetamol / Unilab"
              />
            </label>
            <label>
              Category
              <input
                list="product-form-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Pick or type one"
              />
              <datalist id="product-form-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label>
              Sold per
              <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                {UNITS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="product-form__section">
          <legend>3. Price per {unit.toLowerCase()}</legend>
          <div className="product-form__grid">
            <label>
              Cost (what you pay the supplier)
              <span className="product-form__money">
                <i aria-hidden="true">₱</i>
                <input
                  value={cost}
                  onChange={(event) => setCost(event.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </span>
            </label>
            <label>
              Selling price (what the customer pays)
              <span className="product-form__money">
                <i aria-hidden="true">₱</i>
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </span>
            </label>
          </div>
          {hasCost && (
            <div className="product-form__markups" role="group" aria-label="Set price from cost">
              <span>Price from cost:</span>
              {MARKUPS.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  onClick={() => setPrice((costValue * (1 + percent / 100)).toFixed(2))}
                >
                  +{percent}% = {peso(costValue * (1 + percent / 100))}
                </button>
              ))}
            </div>
          )}
          <div
            className={`product-form__profit${
              profit === null ? '' : profit <= 0 ? ' is-loss' : ' is-gain'
            }`}
            aria-live="polite"
          >
            {profit === null ? (
              <span>Enter the cost and selling price to see the profit.</span>
            ) : profit <= 0 ? (
              <span>
                Selling at a loss: {peso(Math.abs(profit))} less than the cost per{' '}
                {unit.toLowerCase()}.
              </span>
            ) : (
              <>
                <span>Profit per {unit.toLowerCase()}</span>
                <strong>
                  {peso(profit)} <small>({Math.round(markup ?? 0)}% markup)</small>
                </strong>
              </>
            )}
          </div>
        </fieldset>

        <fieldset className="product-form__section">
          <legend>4. Stock</legend>
          {isNew ? (
            <>
              <div className="product-form__grid product-form__grid--three">
                <label>
                  Units on the shelf now
                  <input
                    value={stock}
                    onChange={(event) => setStock(event.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </label>
                <label>
                  Lot number {openingQty > 0 ? '' : '(if any)'}
                  <input
                    value={lot}
                    onChange={(event) => setLot(event.target.value)}
                    placeholder="e.g. BGC-250114"
                    disabled={openingQty === 0}
                  />
                </label>
                <label>
                  Expiry date
                  <input
                    type="date"
                    value={expiry}
                    onChange={(event) => setExpiry(event.target.value)}
                    disabled={openingQty === 0}
                  />
                </label>
              </div>
              <p className="product-form__hint">
                {openingQty > 0
                  ? `${openingQty} ${unit.toLowerCase()}(s) will be added as opening stock${
                      hasCost ? `, worth ${peso(openingQty * costValue)} at cost` : ''
                    }.`
                  : 'Leave it at 0 if the first delivery has not arrived. Add it later with Receive stock.'}
              </p>
            </>
          ) : (
            <p className="product-form__stock">
              <strong>
                {product.stock} {product.unit.toLowerCase()}(s) on hand
              </strong>
              <span>
                To change the stock, use Receive stock (a delivery) or Adjustments (damaged, missing
                or a recount) in the Stock control center, so every change is recorded.
              </span>
            </p>
          )}
        </fieldset>

        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}
        <div className="product-form__actions">
          {onArchive && (
            <button
              className="product-form__archive"
              type="button"
              disabled={saving}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Archive ${product?.product}? It leaves the product list and the Sales Counter. Its history stays, and you can restore it later.`,
                  )
                ) {
                  return;
                }
                setSaving(true);
                const problem = await onArchive();
                setSaving(false);
                if (problem) setError(problem);
              }}
            >
              Archive product
            </button>
          )}
          <button className="product-form__cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="product-form__save" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
/** Days from today to a lot's expiry date (negative = already expired). */
function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
}

/** Horizontal bars: one row per item, bar length relative to the biggest value. */
function BarList({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: number; detail?: string }>;
  empty: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (!rows.length || max === 0) return <p className="overview__empty">{empty}</p>;
  return (
    <ul className="overview-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="overview-bars__label">
            <strong>{row.label}</strong>
            {row.detail && <small>{row.detail}</small>}
          </span>
          <span className="overview-bars__track" aria-hidden="true">
            <span style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </span>
          <span className="overview-bars__value">{money(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Owner overview: the important numbers and charts at a glance. Read only, no controls. */
function AdminDashboard() {
  const threshold = getLowStockThreshold();
  const inventory = getInventory();
  const sales = readCountedSales();
  const sum = (list: SavedSale[]) =>
    list.reduce((total, sale) => total + Number(sale.total ?? 0), 0);
  const onDay = (offset: number) => {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    return sales.filter((sale) => new Date(sale.date).toDateString() === day.toDateString());
  };

  const today = onDay(0);
  const salesToday = sum(today);
  const salesYesterday = sum(onDay(1));
  const now = new Date();
  const monthSales = sales.filter((sale) => {
    const date = new Date(sale.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const unpaidCredit = sales
    .filter((sale) => sale.payment === 'Credit')
    .reduce((total, sale) => total + Math.max(0, Number(sale.creditBalance ?? 0)), 0);
  const stockAtPrice = inventory.reduce(
    (total, product) => total + product.stock * (Number(product.price.replace(/[₱,]/g, '')) || 0),
    0,
  );

  // Last 7 days, today included.
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const list = onDay(6 - index);
    return {
      label: day.toLocaleDateString('en-PH', { weekday: 'short' }),
      date: day.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      total: sum(list),
      list,
    };
  });
  const maxDay = Math.max(...days.map((day) => day.total), 0);
  const weekSales = days.flatMap((day) => day.list);
  // Average sales per hour over the last 7 days: when the store is busiest.
  const hourSlots = hourRange(weekSales.map((sale) => new Date(sale.date))).map((hour) => ({
    hour,
    amount: sum(weekSales.filter((sale) => new Date(sale.date).getHours() === hour)) / 7,
  }));
  const busiest = [...hourSlots].sort((a, b) => b.amount - a.amount).slice(0, 3);

  const byPayment = new Map<string, { amount: number; count: number }>();
  const byProduct = new Map<string, { amount: number; quantity: number }>();
  for (const sale of weekSales) {
    const method = sale.payment ?? 'Cash';
    const paid = byPayment.get(method) ?? { amount: 0, count: 0 };
    byPayment.set(method, { amount: paid.amount + Number(sale.total ?? 0), count: paid.count + 1 });
    for (const line of sale.lines ?? []) {
      const sold = byProduct.get(line.product) ?? { amount: 0, quantity: 0 };
      byProduct.set(line.product, {
        amount: sold.amount + line.quantity * line.unitPrice,
        quantity: sold.quantity + line.quantity,
      });
    }
  }
  const paymentRows = [...byPayment.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([label, value]) => ({
      label,
      value: value.amount,
      detail: `${value.count} sale${value.count === 1 ? '' : 's'}`,
    }));
  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)
    .map(([label, value]) => ({ label, value: value.amount, detail: `${value.quantity} sold` }));

  const lowStock = inventory
    .filter((product) => product.stock < threshold)
    .sort((a, b) => a.stock - b.stock);
  const lots = loadBatches(initialBatches)
    .filter((batch) => batch.stock > 0 && batch.expiry)
    .map((batch) => ({ ...batch, days: daysUntil(batch.expiry) }));
  const expired = lots.filter((lot) => lot.days < 0);
  const expiringSoon = lots.filter((lot) => lot.days >= 0 && lot.days <= 30);

  const change = salesYesterday
    ? `${salesToday >= salesYesterday ? '▲' : '▼'} ${Math.abs(
        Math.round(((salesToday - salesYesterday) / salesYesterday) * 100),
      )}% vs yesterday (${money(salesYesterday)})`
    : `${today.length} sale${today.length === 1 ? '' : 's'} so far`;

  return (
    <div className="cashier-page overview">
      <header className="overview__head">
        <p>
          {now.toLocaleDateString('en-PH', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          · Voided and no-charge sales are left out.
        </p>
      </header>

      <div className="cashier-summary-grid">
        <Summary label="Sales today" value={money(salesToday)} detail={change} />
        <Summary
          label="Sales this month"
          value={money(sum(monthSales))}
          detail={`${monthSales.length} sale${monthSales.length === 1 ? '' : 's'}`}
        />
        <Summary
          label="Unpaid credit (utang)"
          value={money(unpaidCredit)}
          detail="Still owed by customers"
        />
        <Summary
          label="Stock value"
          value={money(stockAtPrice)}
          detail={`${inventory.length} product${inventory.length === 1 ? '' : 's'}, at selling price`}
        />
      </div>

      <div className="overview__grid">
        <section className="cashier-panel overview__card overview__card--wide">
          <h4>Sales · last 7 days</h4>
          {maxDay === 0 ? (
            <p className="overview__empty">No sales in the last 7 days yet.</p>
          ) : (
            <div className="report-chart" role="img" aria-label="Sales for each of the last 7 days">
              {days.map((day) => (
                <div
                  className="report-chart__column"
                  key={day.date}
                  title={`${day.date}: ${money(day.total)}`}
                >
                  <span style={{ height: `${(day.total / maxDay) * 100}%` }} />
                  <small>
                    <strong>{day.label}</strong>
                    <br />
                    {money(day.total)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="cashier-panel overview__card overview__card--wide">
          <div className="dash-card__head">
            <div>
              <h4>Busiest hours · last 7 days</h4>
              <p className="overview__note">
                Average sales per hour. Plan staff for the tall bars.
              </p>
            </div>
            {busiest[0]?.amount > 0 && (
              <div className="dash-chips">
                {busiest
                  .filter((slot) => slot.amount > 0)
                  .map((slot, index) => (
                    <span className={`dash-chip${index === 0 ? ' is-strong' : ''}`} key={slot.hour}>
                      {index + 1}. {formatHour(slot.hour)} · {money(slot.amount)}
                    </span>
                  ))}
              </div>
            )}
          </div>
          {maxDay === 0 ? (
            <p className="overview__empty">No sales in the last 7 days yet.</p>
          ) : (
            <HourlyBars slots={hourSlots} label="Average sales per hour, last 7 days" />
          )}
        </section>

        <section className="cashier-panel overview__card">
          <h4>How customers paid · last 7 days</h4>
          <BarList rows={paymentRows} empty="No sales in the last 7 days yet." />
        </section>

        <section className="cashier-panel overview__card">
          <h4>Best sellers · last 7 days</h4>
          <BarList rows={topProducts} empty="No items sold in the last 7 days yet." />
        </section>

        <section className="cashier-panel overview__card overview__card--wide">
          <h4>Needs attention</h4>
          <div className="overview__alerts">
            <div className={`overview__alert${lowStock.length ? ' is-warn' : ''}`}>
              <strong>{lowStock.length}</strong>
              <span>Low stock (below {threshold})</span>
            </div>
            <div className={`overview__alert${expiringSoon.length ? ' is-warn' : ''}`}>
              <strong>{expiringSoon.length}</strong>
              <span>Lots expiring in 30 days</span>
            </div>
            <div className={`overview__alert${expired.length ? ' is-bad' : ''}`}>
              <strong>{expired.length}</strong>
              <span>Expired lots still on hand</span>
            </div>
          </div>
          {lowStock.length > 0 && (
            <ul className="overview__list">
              {lowStock.slice(0, 5).map((product) => (
                <li key={product.barcode}>
                  <span>{product.product}</span>
                  <StatusBadge value={product.status} />
                  <strong>{product.stock} left</strong>
                </li>
              ))}
            </ul>
          )}
          {(lowStock.length > 0 || expiringSoon.length > 0 || expired.length > 0) && (
            <Link className="overview__more" to="/admin/products">
              Open Products &amp; Stock →
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

type ReportsTab = 'monthly' | 'summary' | 'weekly';

function Reports() {
  const [tab, setTab] = useState<ReportsTab>('monthly');
  // Last 7 days, today included, from the saved sales.
  const sales = readCountedSales();
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const key = day.toDateString();
    const onDay = sales.filter((sale) => new Date(sale.date).toDateString() === key);
    return {
      label: day.toLocaleDateString('en-PH', { weekday: 'short' }),
      date: day.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      total: onDay.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      count: onDay.length,
    };
  });
  const weekTotal = days.reduce((sum, day) => sum + day.total, 0);
  const weekCount = days.reduce((sum, day) => sum + day.count, 0);
  const maxDay = Math.max(...days.map((day) => day.total), 0);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const categoryOf = new Map(getInventory().map((product) => [product.barcode, product.category]));
  const byCategory = new Map<string, number>();
  for (const sale of sales.filter((item) => new Date(item.date) >= weekStart)) {
    for (const line of sale.lines ?? []) {
      const category = (line.barcode && categoryOf.get(line.barcode)) || 'Uncategorized';
      byCategory.set(category, (byCategory.get(category) ?? 0) + line.quantity * line.unitPrice);
    }
  }
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const categoryTotal = [...byCategory.values()].reduce((sum, value) => sum + value, 0);
  const items: Array<ControlItem<ReportsTab>> = [
    {
      key: 'monthly',
      icon: 'calendar',
      title: 'Monthly sales',
      hint: 'Per day, internal summary',
      tone: 'blue',
      about:
        'Internal summary: sales for each day of the month from the sales records saved here, with totals. Export to Excel or save as PDF.',
    },
    {
      key: 'summary',
      icon: 'reports',
      title: 'Sales summary',
      hint: 'Last 7 days at a glance',
      tone: 'forest',
      about: 'Totals for the last 7 days, today included. Voided sales are left out.',
    },
    {
      key: 'weekly',
      icon: 'calendar',
      title: 'Weekly sales',
      hint: 'Day by day',
      tone: 'teal',
      about: 'Sales for each of the last 7 days.',
    },
  ];
  const current = items.find((item) => item.key === tab);

  return (
    <>
      <ControlDeck
        id="reports"
        title="Reports"
        subtitle="Pick a report. It opens in the card below."
        active={tab}
        onSelect={setTab}
        items={items}
      />
      <ControlPanel
        id="reports"
        activeKey={tab}
        title={current?.title ?? 'Reports'}
        about={current?.about}
      >
        {tab === 'monthly' && <MonthlySalesReport />}
        {tab === 'summary' && (
          <div className="cashier-summary-grid">
            <Summary
              label="Sales · last 7 days"
              value={money(weekTotal)}
              detail={`${days[0].date} to ${days[6].date}`}
            />
            <Summary
              label="Transactions"
              value={String(weekCount)}
              detail={`Average ${(weekCount / 7).toFixed(1)} per day`}
            />
            <Summary
              label="Average sale"
              value={money(weekCount ? weekTotal / weekCount : 0)}
              detail="Per completed sale"
            />
            <Summary
              label="Top category"
              value={topCategory ? topCategory[0] : '—'}
              detail={
                topCategory && categoryTotal
                  ? `${Math.round((topCategory[1] / categoryTotal) * 100)}% of sales`
                  : 'No sales yet'
              }
            />
          </div>
        )}
        {tab === 'weekly' && (
          <section className="cashier-panel report-panel">
            {weekCount === 0 ? (
              <p className="register-empty">No sales in the last 7 days yet.</p>
            ) : (
              <div
                className="report-chart"
                role="img"
                aria-label="Sales for each of the last 7 days"
              >
                {days.map((day) => (
                  <div
                    className="report-chart__column"
                    key={day.date}
                    title={`${day.date}: ${money(day.total)}`}
                  >
                    <span
                      style={{ height: `${maxDay ? Math.max(2, (day.total / maxDay) * 100) : 0}%` }}
                    />
                    <small>
                      {day.label} · {money(day.total)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </ControlPanel>
    </>
  );
}
