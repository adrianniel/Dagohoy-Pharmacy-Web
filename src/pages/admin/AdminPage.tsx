import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
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
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
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
          />
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
        <section className="cashier-panel cashier-list-panel">
          <div className="cashier-panel__heading">
            <div>
              <h3>Supplier directory</h3>
              <p>Sample supplier records for workspace planning.</p>
            </div>
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setSupplierFormOpen(true)}
            >
              Add supplier <span>＋</span>
            </button>
          </div>
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
      )}
      {section === 'reports' && <Reports />}
      {section === 'staff' && <StaffAccounts />}
      {section === 'settings' && (
        <section className="cashier-panel settings-form">
          <p className="demo-note">Settings are saved locally in this browser for preview only.</p>
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
                setPharmacySettings({ ...pharmacySettings, businessHours: event.target.value })
              }
              placeholder="Mon–Sat 8:00 AM–8:00 PM · Sun 9:00 AM–6:00 PM"
            />
          </label>
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
          <h3>GCash payment display</h3>
          <p className="demo-note">
            These details are displayed to the cashier at checkout. No payment is processed by this
            app.
          </p>
          <label>
            GCash number
            <input
              inputMode="tel"
              value={pharmacySettings.gcashNumber ?? ''}
              onChange={(event) =>
                setPharmacySettings({ ...pharmacySettings, gcashNumber: event.target.value })
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
          <button
            className="cashier-primary-action"
            type="button"
            onClick={() => {
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(pharmacySettings));
              window.dispatchEvent(new Event('pharmacy-settings-changed'));
              showToast('Settings saved in this browser.');
            }}
          >
            Save changes
          </button>
        </section>
      )}
      {supplierFormOpen && (
        <SupplierForm
          onClose={() => setSupplierFormOpen(false)}
          onSave={(value) => {
            const next = [...supplierList, value];
            setSupplierList(next);
            localStorage.setItem(SUPPLIER_KEY, JSON.stringify(next));
            setSupplierFormOpen(false);
            showToast('Supplier saved in this browser.');
          }}
        />
      )}
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

function SupplierForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (value: Supplier) => void;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  return (
    <div className="pos-modal-backdrop">
      <form
        className="pos-payment-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name: name.trim(), contact: contact.trim(), products: 0, status: 'Active' });
        }}
      >
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close form">
          ×
        </button>
        <p className="eyebrow">Supplier directory · demo</p>
        <h2>Add supplier</h2>
        <p className="inventory-form-note">This creates a local preview record only.</p>
        <label>
          Supplier name
          <input
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Phone, email, or location
          <input required value={contact} onChange={(event) => setContact(event.target.value)} />
        </label>
        <button className="pos-checkout-button" type="submit">
          Save supplier
        </button>
      </form>
    </div>
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

function AdminDashboard() {
  return (
    <div className="cashier-page">
      <div className="cashier-summary-grid">
        <Summary label="Sales today" value={money(18460.5)} detail="Demo data · 24 transactions" />
        <Summary label="Transactions" value="24" detail="Sample register activity" />
        <Summary label="Inventory value" value={money(283450)} detail="Illustrative retail value" />
        <Summary
          label="Needs attention"
          value={`${getInventory().filter((product) => product.stock < 20).length} items`}
          detail="Sample low-stock alerts"
        />
      </div>
      <div className="cashier-dashboard-grid admin-dashboard-grid">
        <section className="cashier-panel">
          <div className="cashier-panel__heading">
            <div>
              <h3>Inventory alerts</h3>
              <p>Replenish these products to avoid missed sales.</p>
            </div>
            <Link to="/admin/products">View inventory</Link>
          </div>
          <div
            className="cashier-table-wrap"
            role="region"
            aria-label="Recent sales table"
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
                {getInventory()
                  .filter((product) => product.stock < getLowStockThreshold())
                  .map((product) => (
                    <tr key={product.barcode}>
                      <td>
                        <strong>{product.product}</strong>
                      </td>
                      <td>{product.stock}</td>
                      <td>20</td>
                      <td>
                        <StatusBadge value={product.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="cashier-panel admin-quick-actions">
          <h3>Quick actions</h3>
          <Link to="/cashier/pos">
            <CashierIcon name="pos" /> New sale <span>→</span>
          </Link>
          <Link to="/admin/products">
            <CashierIcon name="inventory" /> Review stock <span>→</span>
          </Link>
          <Link to="/admin/batches">
            <CashierIcon name="batches" /> Check expiry dates <span>→</span>
          </Link>
          <Link to="/admin/purchases">
            <CashierIcon name="purchases" /> Receive stock <span>→</span>
          </Link>
          <Link to="/admin/reports">
            <CashierIcon name="reports" /> Sales report <span>→</span>
          </Link>
          <div className="demo-note">
            Dashboard figures are sample data, not live pharmacy records.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Reports() {
  const values = [42, 56, 48, 72, 64, 88, 73];
  return (
    <>
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
      <section className="cashier-panel report-panel">
        <div className="cashier-panel__heading">
          <div>
            <h3>Weekly sales</h3>
            <p>Sales totals are mock examples pending a reporting API.</p>
          </div>
          <span className="report-period">Last 7 days</span>
        </div>
        <div className="report-chart" role="img" aria-label="Illustrative weekly sales chart">
          {values.map((value, index) => (
            <div className="report-chart__column" key={index}>
              <span style={{ height: `${value}%` }} />
              <small>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
