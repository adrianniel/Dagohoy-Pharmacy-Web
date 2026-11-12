import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { InvoiceGuide } from '../../components/admin/InvoiceGuide';
import { MonthlySalesReport } from '../../components/admin/MonthlySalesReport';
import { ProfitReport } from '../../components/admin/ProfitReport';
import { StockControlCenter } from '../../components/admin/StockControlCenter';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { HourlyBars } from '../../components/HourlyBars';
import { formatHour, hourRange } from '../../components/hours';
import { ScanInput } from '../../components/ScanInput';
import { cleanBatch } from '../../data/batchCode';
import { notifyBillingChanged, useBilling, useScannerOff } from '../../services/useBilling';
import { useToast } from '../../components/toast';
import {
  getInventory,
  getLowStockThreshold,
  InventoryProduct,
  stockStatus,
} from '../../data/inventoryStore';
import { initialBatches, loadBatches } from '../../data/operationsStore';
import {
  archiveProduct,
  createProduct,
  lookupBarcode,
  createSupplier,
  setSupplierActive,
  saveSettings as saveStoreSettings,
  updateProduct,
  registerProduct,
} from '../../services/storeApi';
import { cacheSettings, syncAfterStockChange, syncSuppliers } from '../../data/serverSync';
import { ArchivedProducts } from '../../components/admin/ArchivedProducts';
import { ProductImport } from '../../components/admin/ProductImport';
import { getCurrentAccount } from '../../data/accountStore';
import { StaffAccounts } from './StaffAccounts';

type AdminSection = 'dashboard' | 'products' | 'suppliers' | 'reports' | 'staff' | 'settings';
type SupplierTab = 'list' | 'archived' | 'add';
type SettingsTab = 'details' | 'alerts' | 'gcash';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
type Supplier = { id?: string; name: string; contact: string; products?: number; status: string };
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
  const [importOpen, setImportOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  /** Product list, or the products scanned and sold at the Sales Counter before they were added. */
  const [listView, setListView] = useState<'list' | 'unregistered'>('list');
  const isAdmin = getCurrentAccount()?.role === 'ADMIN';
  // Subscription unpaid past the allowance: search matches names only, not barcodes.
  const scannerOff = useScannerOff();

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
    () => products.filter((product) => !product.unregistered && product.stock < restockThreshold),
    [products, restockThreshold],
  );
  const registeredProducts = useMemo(
    () => products.filter((product) => !product.unregistered),
    [products],
  );
  const unregisteredProducts = useMemo(
    () => products.filter((product) => product.unregistered),
    [products],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          Boolean(product.unregistered) === (listView === 'unregistered') &&
          `${product.product} ${product.detail} ${scannerOff ? '' : product.barcode}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [products, query, scannerOff, listView],
  );

  const activeSuppliers = supplierList.filter((supplier) => supplier.status !== 'Inactive');
  const archivedSuppliers = supplierList.filter((supplier) => supplier.status === 'Inactive');

  /** Archive or restore a supplier. Archived ones leave the list and the Receive stock form. */
  async function changeSupplier(supplier: Supplier, active: boolean) {
    if (!supplier.id) return;
    if (
      !active &&
      !window.confirm(
        `Archive ${supplier.name}? It leaves the supplier list and Receive stock. Past deliveries keep its name, and you can restore it under Archived.`,
      )
    ) {
      return;
    }
    try {
      await setSupplierActive(Number(supplier.id), active);
      await syncSuppliers();
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : 'Could not change the supplier.',
        'error',
      );
      return;
    }
    setSupplierList(loadLocalList(SUPPLIER_KEY, suppliers));
    showToast(active ? `${supplier.name} restored.` : `${supplier.name} archived.`);
  }

  const supplierItems: Array<ControlItem<SupplierTab>> = [
    {
      key: 'list',
      icon: 'suppliers',
      title: 'Supplier list',
      hint: 'Who supplies the stock',
      tone: 'forest',
      count: activeSuppliers.length,
    },
    {
      key: 'archived',
      icon: 'stock',
      title: 'Archived',
      hint: 'No longer used',
      tone: 'slate',
      count: archivedSuppliers.length,
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
            products={registeredProducts}
            threshold={restockThreshold}
            restockCount={restockProducts.length}
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
              {!showArchived && (
                <div className="product-list-switch" role="tablist" aria-label="Which products">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listView === 'list'}
                    className={listView === 'list' ? 'is-active' : ''}
                    onClick={() => setListView('list')}
                  >
                    Product list <b>{products.length - unregisteredProducts.length}</b>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listView === 'unregistered'}
                    className={`${listView === 'unregistered' ? 'is-active' : ''}${
                      unregisteredProducts.length ? ' has-items' : ''
                    }`}
                    onClick={() => setListView('unregistered')}
                  >
                    Unregistered <b>{unregisteredProducts.length}</b>
                  </button>
                </div>
              )}
              {!showArchived && listView === 'unregistered' && (
                <p className="product-list-switch__note">
                  Scanned and sold at the Sales Counter before they were added. Press Register to
                  fill in the cost, the units on the shelf now, the batch number and the expiry
                  date.
                </p>
              )}
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
                          <td>{product.unregistered ? '—' : product.stock}</td>
                          <td>
                            {product.unregistered ? (
                              <span className="product-new-badge">Not registered</span>
                            ) : (
                              <StatusBadge value={product.status} />
                            )}
                          </td>
                          <td>
                            <button
                              className={
                                product.unregistered
                                  ? 'cashier-primary-action'
                                  : 'cashier-view-button'
                              }
                              type="button"
                              onClick={() => {
                                setEditing(product);
                                setFormOpen(true);
                              }}
                            >
                              {product.unregistered ? 'Register' : 'Edit / stock'}
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
                  Showing {filteredProducts.length}{' '}
                  {listView === 'unregistered' ? 'unregistered ' : ''}product
                  {filteredProducts.length === 1 ? '' : 's'}
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
                  if (editing?.id && editing.unregistered) {
                    await registerProduct(
                      editing.id,
                      opening && product.stock > 0
                        ? { ...fields, opening: { quantity: product.stock, ...opening } }
                        : fields,
                    );
                  } else if (editing?.id) {
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
                showToast(
                  editing?.unregistered
                    ? `${product.product} registered and moved to the product list.`
                    : `${product.product} saved.`,
                );
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
          {(supplierTab === 'list' || supplierTab === 'archived') && (
            <ControlPanel
              id="suppliers"
              activeKey={supplierTab}
              title={supplierTab === 'list' ? 'Supplier list' : 'Archived suppliers'}
              about={
                supplierTab === 'list'
                  ? 'Everyone the pharmacy buys stock from.'
                  : 'Suppliers no longer used. Restore one to pick it again when stock is delivered.'
              }
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
                      {(supplierTab === 'list' ? activeSuppliers : archivedSuppliers).map(
                        (supplier) => (
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
                              <div className="staff-row-actions">
                                <button
                                  className="cashier-view-button"
                                  type="button"
                                  onClick={() =>
                                    showToast(
                                      `${supplier.name} · ${supplier.contact || 'No location'} · ${supplierLots(supplier.name)} batches received`,
                                      'info',
                                    )
                                  }
                                >
                                  View details
                                </button>
                                <button
                                  className="cashier-view-button"
                                  type="button"
                                  onClick={() =>
                                    void changeSupplier(supplier, supplierTab !== 'list')
                                  }
                                >
                                  {supplierTab === 'list' ? 'Archive' : 'Restore'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="cashier-table-footer">
                  <span>
                    {(supplierTab === 'list' ? activeSuppliers : archivedSuppliers).length}{' '}
                    {supplierTab === 'list' ? 'active' : 'archived'} supplier(s)
                  </span>
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
  const billing = useBilling();
  const isNew = !product;
  /** Sold at the Sales Counter before it was on the list: fill in the rest and the stock. */
  const registering = Boolean(product?.unregistered);
  const withOpening = isNew || registering;
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
  /** What the barcode scan found (or that nothing was found), shown under the barcode field. */
  const [lookupNote, setLookupNote] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');

  /**
   * New product only: asks the server for a scanned barcode's details and fills the fields that
   * are still empty. The user checks them. The wording never says where the details come from.
   */
  async function fillFromBarcode(code: string) {
    if (!isNew || !/^\d{8,14}$/.test(code)) return;
    setLookupNote('New product scanned. Getting its details, this may take a few seconds…');
    setLookupState('loading');
    try {
      const result = await lookupBarcode(code);
      notifyBillingChanged(); // a scan may have used a free scan
      if (result.status === 'found') {
        const found = result.suggestion;
        setName((current) => current || found.name);
        setDetail((current) => current || found.brand || '');
        setCategory((current) => current || found.category || '');
        if (found.unit && UNITS.includes(found.unit)) setUnit(found.unit);
        setLookupState('found');
        setLookupNote(
          `Details filled in${
            found.strength ? ` (strength ${found.strength})` : ''
          }. Check the name and add the generic name before saving.`,
        );
      } else if (result.status === 'in_catalog') {
        setLookupNote('');
        setError(`Barcode ${code} is already used by ${result.name}.`);
      } else if (result.status === 'not_found') {
        setLookupState('missing');
        setLookupNote('No details found for this barcode. Type them in.');
      } else if (result.status === 'invalid_barcode') {
        setLookupNote('');
      } else if (result.status === 'paused') {
        setLookupState('missing');
        setLookupNote(
          'Barcode lookup service is paused: the monthly subscription is not paid. Type the details in, and pay it in Subscription.',
        );
      } else {
        setLookupState('missing');
        setLookupNote('Could not get the details right now. Type them in.');
      }
    } catch {
      setLookupState('missing');
      setLookupNote('Could not get the details right now. Type them in.');
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
    if (withOpening && openingQty > 0) {
      if (!lot.trim()) {
        setError('Enter the batch number of the stock you are adding.');
        return;
      }
      if (!expiry) {
        setError('Enter the expiry date of the stock you are adding.');
        return;
      }
    }
    const quantity = withOpening ? openingQty : product.stock;
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
      withOpening && openingQty > 0 ? { lot: lot.trim().toUpperCase(), expiry } : undefined,
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
        <h2>
          {isNew
            ? 'New product'
            : registering
              ? `Register ${product.product}`
              : `Edit ${product.product}`}
        </h2>
        <p className="inventory-form-note">
          {isNew
            ? 'For a medicine or item that is not in the list yet.'
            : registering
              ? 'Sold at the Sales Counter before it was on the list. Check the details, then fill in what is missing: cost, units on the shelf now, batch number and expiry date.'
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
            {isNew && billing?.status === 'trial' && (
              <p className="product-form__free">
                Free trial: <b>{billing.freeScans.left}</b> of {billing.freeScans.total} free scans
                left
              </p>
            )}
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
          {withOpening ? (
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
                  Batch number {openingQty > 0 ? '' : '(if any)'}
                  <input
                    value={lot}
                    onChange={(event) => setLot(cleanBatch(event.target.value))}
                    placeholder="e.g. BGC-250114"
                    title="Letters, numbers and - only"
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
            {saving
              ? 'Saving…'
              : isNew
                ? 'Add product'
                : registering
                  ? 'Register product'
                  : 'Save changes'}
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

/** One overview widget: icon, label, the amount (cents dimmed), a small badge and a link. */
function Widget({
  icon,
  label,
  sub,
  value,
  badge,
  down = false,
  note,
  to,
  tone,
}: {
  icon: Parameters<typeof CashierIcon>[0]['name'];
  label: string;
  sub: string;
  value: number;
  badge?: string;
  down?: boolean;
  note?: string;
  to: string;
  tone?: 'green';
}) {
  const [pesos, cents] = money(value).split('.');
  return (
    <article className={`overview-widget${tone ? ` is-${tone}` : ''}`}>
      <header>
        <span className="overview-widget__icon" aria-hidden="true">
          <CashierIcon name={icon} />
        </span>
        <span className="overview-widget__label">
          {label}
          <small>{sub}</small>
        </span>
        <Link className="overview-widget__open" to={to} aria-label={`Open ${label}`}>
          <CashierIcon name="arrow" />
        </Link>
      </header>
      <p className="overview-widget__value">
        {pesos}
        {cents !== undefined && <span>.{cents}</span>}
        {badge && <em className={down ? 'is-down' : ''}>{badge}</em>}
      </p>
      {note && <p className="overview-widget__note">{note}</p>}
    </article>
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
    .filter((product) => !product.unregistered && product.stock < threshold)
    .sort((a, b) => a.stock - b.stock);
  const lots = loadBatches(initialBatches)
    .filter((batch) => batch.stock > 0 && batch.expiry)
    .map((batch) => ({ ...batch, days: daysUntil(batch.expiry) }));
  const expired = lots.filter((lot) => lot.days < 0);
  const expiringSoon = lots.filter((lot) => lot.days >= 0 && lot.days <= 30);

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

      {/* Small widgets: label, one number, a hint. The cents are dimmed so the pesos read first. */}
      <section className="overview-widgets" aria-label="Today and this month">
        <Widget
          tone="green"
          icon="cash"
          label="Sales today"
          sub={
            today.length ? `${today.length} sale${today.length === 1 ? '' : 's'}` : 'No sales yet'
          }
          value={salesToday}
          badge={
            today.length && salesYesterday
              ? `${salesToday >= salesYesterday ? '+' : '−'}${Math.abs(
                  Math.round(((salesToday - salesYesterday) / salesYesterday) * 100),
                )}%`
              : undefined
          }
          down={salesToday < salesYesterday}
          note={`Yesterday ${money(salesYesterday)}`}
          to="/cashier/transactions"
        />
        <Widget
          icon="reports"
          label="This month"
          sub={now.toLocaleDateString('en-PH', { month: 'long' })}
          value={sum(monthSales)}
          badge={`${monthSales.length} sales`}
          to="/admin/reports"
        />
        <Widget
          icon="credit"
          label="Utang unpaid"
          sub="Still owed by customers"
          value={unpaidCredit}
          down={unpaidCredit > 0}
          to="/admin/credits"
        />
        <Widget
          icon="inventory"
          label="Stock value"
          sub="At selling price"
          value={stockAtPrice}
          badge={`${inventory.length} products`}
          to="/admin/products"
        />
      </section>

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
              <span>Batches expiring in 30 days</span>
            </div>
            <div className={`overview__alert${expired.length ? ' is-bad' : ''}`}>
              <strong>{expired.length}</strong>
              <span>Expired batches still on hand</span>
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

type ReportsTab = 'profit' | 'monthly' | 'invoice' | 'summary' | 'weekly';

function Reports() {
  const [tab, setTab] = useState<ReportsTab>('profit');
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
      key: 'profit',
      icon: 'reports',
      title: 'Profit',
      hint: 'Did the store earn?',
      tone: 'forest',
      about:
        'Sales minus what the sold items cost, the expenses, items given free and stock lost. Month by month, with where the money went.',
    },
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
      key: 'invoice',
      icon: 'receipt',
      title: 'Invoice guide',
      hint: 'For the BIR booklet',
      tone: 'amber',
      about:
        'Each day of sales laid out like a page of the sales invoice booklet, from the sales recorded here, so the booklet is copied from real numbers. Export to Excel or save as PDF.',
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
        {tab === 'profit' && <ProfitReport />}
        {tab === 'monthly' && <MonthlySalesReport />}
        {tab === 'invoice' && <InvoiceGuide />}
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
