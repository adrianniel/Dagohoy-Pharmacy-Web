import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { StockControlCenter } from '../../components/admin/StockControlCenter';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { useToast } from '../../components/toast';
import {
  getInventory,
  getLowStockThreshold,
  InventoryProduct,
  saveInventory,
  stockStatus,
} from '../../data/inventoryStore';
import { suggestProductCategories } from '../../services/productsApi';
import { StaffAccounts } from './StaffAccounts';

type AdminSection = 'dashboard' | 'products' | 'suppliers' | 'reports' | 'staff' | 'settings';
type SupplierTab = 'list' | 'add';
type SettingsTab = 'details' | 'alerts' | 'gcash';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const suppliers = [
  { name: 'Unilab, Inc.', contact: 'Metro Manila', products: 28, status: 'Active' },
  { name: 'Mercury Drug Wholesale', contact: 'Taguig City', products: 16, status: 'Active' },
  { name: 'Natrapharm, Inc.', contact: 'Makati City', products: 12, status: 'Active' },
];
type Supplier = (typeof suppliers)[number];
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
  phone: '+63 2 8123 4567',
  address: 'Bohol, Philippines',
  email: '[Pharmacy email]',
  businessHours: 'Mon–Sat 8:00 AM–8:00 PM · Sun 9:00 AM–6:00 PM',
  threshold: '15',
};
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
  const searchRef = useRef<HTMLInputElement>(null);
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
      const next = products.map((product) => ({
        ...product,
        category: categoryById.get(product.barcode) ?? product.category,
      }));
      setProducts(next);
      saveInventory(next);
      showToast(`${suggestions.length} category suggestions applied. Please review them.`, 'info');
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
      about: 'Shown on receipts and the public page. Keep the name, number and address correct.',
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

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(pharmacySettings));
    window.dispatchEvent(new Event('pharmacy-settings-changed'));
    showToast('Settings saved in this browser.');
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
                <label className="cashier-search-field cashier-search-field--wide">
                  <CashierIcon name="search" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search product, generic, brand, or barcode"
                  />
                </label>
                <button
                  className="cashier-primary-action"
                  type="button"
                  onClick={() => {
                    setEditing(null);
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
              </div>
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
              <div className="cashier-table-footer">
                <span>Showing {filteredProducts.length} sample products</span>
                <span>Inventory is demo data until connected to the pharmacy API.</span>
              </div>
            </section>
          </StockControlCenter>
          {formOpen && (
            <InventoryForm
              product={editing}
              onClose={() => setFormOpen(false)}
              onSave={(product) => {
                if (
                  products.some(
                    (item) => item.barcode === product.barcode && item.barcode !== editing?.barcode,
                  )
                ) {
                  return false;
                }
                const next = editing
                  ? products.map((item) => (item.barcode === editing.barcode ? product : item))
                  : [...products, product];
                setProducts(next);
                saveInventory(next);
                setFormOpen(false);
                showToast(`${product.product} saved in this browser.`);
                return true;
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
              about="Everyone the pharmacy buys stock from. These records are saved in this browser only."
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
                          <td>{supplier.products} products</td>
                          <td>
                            <StatusBadge value={supplier.status} />
                          </td>
                          <td>
                            <button
                              className="cashier-view-button"
                              type="button"
                              onClick={() =>
                                showToast(
                                  `${supplier.name} · ${supplier.contact} · ${supplier.products} sample products`,
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
                  <span>Supplier records are local demo data.</span>
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
                onSave={(value) => {
                  const next = [...supplierList, value];
                  setSupplierList(next);
                  localStorage.setItem(SUPPLIER_KEY, JSON.stringify(next));
                  setSupplierTab('list');
                  showToast('Supplier saved in this browser.');
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
              <button className="cashier-primary-action" type="button" onClick={saveSettings}>
                Save changes
              </button>
            }
          >
            <section className="cashier-panel settings-form">
              <p className="demo-note">
                Settings are saved locally in this browser for preview only.
              </p>
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
                      placeholder="[Pharmacy email]"
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
  onSave: (value: Supplier) => void;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  return (
    <form
      className="cashier-panel settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name: name.trim(), contact: contact.trim(), products: 0, status: 'Active' });
      }}
    >
      <p className="demo-note">This creates a local preview record only.</p>
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
      <div className="stock-index__actions">
        <button className="cashier-primary-action" type="submit">
          Save supplier
        </button>
        <button className="cashier-view-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function InventoryForm({
  product,
  onClose,
  onSave,
}: {
  product: InventoryProduct | null;
  onClose: () => void;
  onSave: (product: InventoryProduct) => boolean;
}) {
  const [name, setName] = useState(product?.product ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [detail, setDetail] = useState(product?.detail ?? '');
  const [category, setCategory] = useState(product?.category ?? 'Other');
  const [unit, setUnit] = useState(product?.unit ?? 'Tablet');
  const [price, setPrice] = useState(product ? product.price.replace(/[₱,]/g, '') : '');
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Math.max(0, Number(stock));
    const saved = onSave({
      barcode,
      product: name.trim(),
      detail: detail.trim(),
      category: category.trim(),
      unit,
      price: `₱${Number(price).toFixed(2)}`,
      stock: quantity,
      status: stockStatus(quantity),
    });
    if (!saved) setError('That barcode is already assigned to another product.');
  }
  return (
    <div
      className="pos-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="pos-payment-modal inventory-form" onSubmit={submit}>
        <button
          className="pos-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close product form"
        >
          ×
        </button>
        <p className="eyebrow">Inventory · demo mode</p>
        <h2>{product ? 'Update product' : 'Add product'}</h2>
        <p className="inventory-form-note">
          Changes are saved to this browser only and are not sent to the pharmacy server.
        </p>
        <label>
          Product name
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Barcode / SKU
          <input required value={barcode} onChange={(event) => setBarcode(event.target.value)} />
        </label>
        <label>
          Generic / brand
          <input required value={detail} onChange={(event) => setDetail(event.target.value)} />
        </label>
        <label>
          Category
          <input required value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <div className="inventory-form-row">
          <label>
            Unit
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>
              <option>Tablet</option>
              <option>Capsule</option>
              <option>Bottle</option>
              <option>Pack</option>
              <option>Box</option>
              <option>Piece</option>
            </select>
          </label>
          <label>
            Price (₱)
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
        </div>
        <label>
          On-hand quantity
          <input
            required
            min="0"
            step="1"
            type="number"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
          />
        </label>
        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}
        <button className="pos-checkout-button" type="submit">
          Save product
        </button>
      </form>
    </div>
  );
}

type OverviewTab = 'today' | 'alerts' | 'actions';

function AdminDashboard() {
  const [tab, setTab] = useState<OverviewTab>('today');
  const threshold = getLowStockThreshold();
  const lowStock = getInventory().filter((product) => product.stock < threshold);
  const items: Array<ControlItem<OverviewTab>> = [
    {
      key: 'today',
      icon: 'dashboard',
      title: 'Today',
      hint: 'Sales and stock value',
      tone: 'forest',
      about: 'A quick look at the day. These figures are sample data, not live pharmacy records.',
    },
    {
      key: 'alerts',
      icon: 'inventory',
      title: 'Inventory alerts',
      hint: lowStock.length ? 'Need restocking' : 'All above reorder point',
      tone: 'amber',
      count: lowStock.length,
      alert: lowStock.length > 0,
      about: `Products below the reorder point of ${threshold} units. Restock them to avoid missed sales.`,
    },
    {
      key: 'actions',
      icon: 'arrow',
      title: 'Quick actions',
      hint: 'Jump to a task',
      tone: 'blue',
      about: 'Shortcuts to the pages you use most.',
    },
  ];
  const current = items.find((item) => item.key === tab);

  return (
    <div className="cashier-page">
      <ControlDeck
        id="overview"
        title="Overview"
        subtitle="Pick what to look at. It opens in the card below."
        active={tab}
        onSelect={setTab}
        items={items}
      />
      <ControlPanel
        id="overview"
        activeKey={tab}
        title={current?.title ?? 'Overview'}
        about={current?.about}
      >
        {tab === 'today' && (
          <div className="cashier-summary-grid">
            <Summary
              label="Sales today"
              value={money(18460.5)}
              detail="Demo data · 24 transactions"
            />
            <Summary label="Transactions" value="24" detail="Sample register activity" />
            <Summary
              label="Inventory value"
              value={money(283450)}
              detail="Illustrative retail value"
            />
            <Summary
              label="Needs attention"
              value={`${lowStock.length} items`}
              detail={`Below ${threshold} units`}
            />
          </div>
        )}
        {tab === 'alerts' &&
          (lowStock.length === 0 ? (
            <p className="stock-index__empty">
              Every product is at or above the reorder point of {threshold} units.
            </p>
          ) : (
            <section className="cashier-panel">
              <div
                className="cashier-table-wrap"
                role="region"
                aria-label="Inventory alerts table"
                tabIndex={0}
              >
                <table className="cashier-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>On hand</th>
                      <th>Reorder point</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((product) => (
                      <tr key={product.barcode}>
                        <td>
                          <strong>{product.product}</strong>
                        </td>
                        <td>{product.stock}</td>
                        <td>{threshold}</td>
                        <td>
                          <StatusBadge value={product.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cashier-table-footer">
                <span>{lowStock.length} product(s) to restock</span>
                <Link to="/admin/products">View inventory</Link>
              </div>
            </section>
          ))}
        {tab === 'actions' && (
          <aside className="cashier-panel admin-quick-actions">
            <Link to="/cashier/pos">
              <CashierIcon name="pos" /> New sale <span>→</span>
            </Link>
            <Link to="/admin/products">
              <CashierIcon name="inventory" /> Review stock <span>→</span>
            </Link>
            <Link to="/admin/reports">
              <CashierIcon name="reports" /> Sales report <span>→</span>
            </Link>
          </aside>
        )}
      </ControlPanel>
    </div>
  );
}

type ReportsTab = 'summary' | 'weekly';

function Reports() {
  const [tab, setTab] = useState<ReportsTab>('summary');
  const values = [42, 56, 48, 72, 64, 88, 73];
  const items: Array<ControlItem<ReportsTab>> = [
    {
      key: 'summary',
      icon: 'reports',
      title: 'Sales summary',
      hint: 'This week at a glance',
      tone: 'forest',
      about: 'Totals for the week. These are sample numbers until sales are connected.',
    },
    {
      key: 'weekly',
      icon: 'calendar',
      title: 'Weekly sales',
      hint: 'Day by day',
      tone: 'teal',
      about: 'Sales for each day of the last 7 days. Sample numbers until sales are connected.',
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
        {tab === 'summary' && (
          <div className="cashier-summary-grid">
            <Summary
              label="Gross sales · this week"
              value={money(94620)}
              detail="Sample reporting period"
            />
            <Summary label="Transactions" value="138" detail="Average 20 per day" />
            <Summary label="Average basket" value={money(685.65)} detail="Per completed sale" />
            <Summary label="Top category" value="OTC medicine" detail="32% of sales" />
          </div>
        )}
        {tab === 'weekly' && (
          <section className="cashier-panel report-panel">
            <div className="report-chart" role="img" aria-label="Illustrative weekly sales chart">
              {values.map((value, index) => (
                <div className="report-chart__column" key={index}>
                  <span style={{ height: `${value}%` }} />
                  <small>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </ControlPanel>
    </>
  );
}
