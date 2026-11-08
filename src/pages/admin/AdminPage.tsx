import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { MonthlySalesReport } from '../../components/admin/MonthlySalesReport';
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
import {
  initialBatches,
  loadBatches,
  loadMovements,
  saveBatches,
  saveMovements,
} from '../../data/operationsStore';
import { getSession } from '../../data/registerSession';
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
              products={products}
              onClose={() => setFormOpen(false)}
              onSave={(product, opening) => {
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
                // A new product with opening stock gets its first lot and a stock-in record,
                // so the stock history and lots start right.
                if (!editing && opening && product.stock > 0) {
                  const now = new Date().toISOString();
                  const id = Date.now().toString().slice(-6);
                  const session = getSession();
                  saveBatches([
                    ...loadBatches(initialBatches),
                    {
                      id: `B-${id}`,
                      product: product.product,
                      barcode: product.barcode,
                      lot: opening.lot,
                      expiry: opening.expiry,
                      stock: product.stock,
                      receivedAt: now,
                      unitCost: product.cost,
                    },
                  ]);
                  saveMovements([
                    {
                      id: `RCV-${id}`,
                      date: now,
                      product: product.product,
                      kind: 'Received',
                      change: product.stock,
                      reference: 'Opening stock',
                      staff: session?.onDutyNames?.[0] ?? session?.cashierName ?? 'Admin',
                      reason: `Opening stock · lot ${opening.lot}${
                        product.cost ? ` · ₱${product.cost.toFixed(2)}/unit` : ''
                      }`,
                      unitCost: product.cost,
                    },
                    ...loadMovements(),
                  ]);
                }
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
  onClose,
  onSave,
}: {
  product: InventoryProduct | null;
  products: InventoryProduct[];
  onClose: () => void;
  onSave: (product: InventoryProduct, opening?: { lot: string; expiry: string }) => boolean;
}) {
  const isNew = !product;
  const [name, setName] = useState(product?.product ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [detail, setDetail] = useState(product?.detail ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'Tablet');
  const [cost, setCost] = useState(product?.cost ? String(product.cost) : '');
  const [price, setPrice] = useState(product ? product.price.replace(/[₱,]/g, '') : '');
  const [stock, setStock] = useState('');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState('');

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const saved = onSave(
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
    if (!saved) setError('That barcode is already used by another product.');
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
            ? 'For a medicine or item that is not in the list yet. Saved in this browser only.'
            : 'Change the details and prices. Saved in this browser only.'}
        </p>

        <fieldset className="product-form__section">
          <legend>1. What it is</legend>
          <div className="product-form__grid">
            <label className="product-form__wide">
              Product name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Biogesic 500mg"
                autoFocus
              />
            </label>
            <label>
              Barcode / SKU
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Scan or type it"
                inputMode="numeric"
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
          <legend>2. Price per {unit.toLowerCase()}</legend>
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
          <legend>3. Stock</legend>
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
          <button className="product-form__cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="product-form__save" type="submit">
            {isNew ? 'Add product' : 'Save changes'}
          </button>
        </div>
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

type ReportsTab = 'monthly' | 'summary' | 'weekly';

function Reports() {
  const [tab, setTab] = useState<ReportsTab>('monthly');
  const values = [42, 56, 48, 72, 64, 88, 73];
  const items: Array<ControlItem<ReportsTab>> = [
    {
      key: 'monthly',
      icon: 'calendar',
      title: 'Monthly sales',
      hint: 'Per day, for BIR checks',
      tone: 'blue',
      about:
        'Sales for each day of the month from the receipts saved here, with totals. Export to Excel or save as PDF.',
    },
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
        {tab === 'monthly' && <MonthlySalesReport />}
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
