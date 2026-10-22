import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import {
  getInventory,
  InventoryProduct,
  saveInventory,
  stockStatus,
} from '../../data/inventoryStore';

type AdminSection = 'dashboard' | 'products' | 'suppliers' | 'reports' | 'staff' | 'settings';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const suppliers = [
  { name: 'Unilab, Inc.', contact: 'Metro Manila', products: 28, status: 'Active' },
  { name: 'Mercury Drug Wholesale', contact: 'Taguig City', products: 16, status: 'Active' },
  { name: 'Natrapharm, Inc.', contact: 'Makati City', products: 12, status: 'Active' },
];
const staff = [
  { initials: 'MD', name: 'Maria Dela Cruz', role: 'Cashier', status: 'On shift' },
  { initials: 'JR', name: 'Jose Reyes', role: 'Cashier', status: 'Off shift' },
  { initials: 'AL', name: 'Ana Lim', role: 'Administrator', status: 'Active' },
];

export function AdminPage({ section }: { section: AdminSection }) {
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const [products, setProducts] = useState(getInventory);
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.product} ${product.detail} ${product.barcode}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [products, query],
  );
  const title: Record<AdminSection, string> = {
    dashboard: 'Good morning, Ana',
    products: 'Products & stock',
    suppliers: 'Suppliers',
    reports: 'Business reports',
    staff: 'Team & access',
    settings: 'Pharmacy settings',
  };
  const description: Record<AdminSection, string> = {
    dashboard: 'Here’s what’s happening at your pharmacy today.',
    products: 'Monitor stock levels, pricing, and product availability.',
    suppliers: 'Keep supplier contacts and purchasing relationships organized.',
    reports: 'Review sales performance and inventory health.',
    staff: 'Manage staff visibility and daily shift status.',
    settings: 'Manage the details shown across your pharmacy workspace.',
  };

  if (section === 'dashboard') return <AdminDashboard />;

  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Owner workspace"
        title={title[section]}
        description={description[section]}
      />
      {section === 'products' && (
        <>
          <div className="cashier-summary-grid">
            <Summary label="Active products" value="248" detail="Across all categories" />
            <Summary label="Low stock" value="12" detail="Review and replenish" />
            <Summary label="Out of stock" value="3" detail="Needs attention" />
            <Summary label="Expiring soon" value="8" detail="Within 90 days" />
          </div>
          <section className="cashier-panel cashier-list-panel">
            <div className="cashier-list-toolbar">
              <label className="cashier-search-field cashier-search-field--wide">
                <CashierIcon name="search" />
                <input
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
              <Link className="cashier-primary-action" to="/cashier/products">
                Cashier lookup <CashierIcon name="arrow" />
              </Link>
            </div>
            <div className="cashier-table-wrap">
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
                      <td>{product.detail}</td>
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
                const next = editing
                  ? products.map((item) => (item.barcode === editing.barcode ? product : item))
                  : [...products, product];
                setProducts(next);
                saveInventory(next);
                setFormOpen(false);
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
              onClick={() =>
                window.alert(
                  'Supplier creation will be available when the supplier API is connected.',
                )
              }
            >
              Add supplier <span>＋</span>
            </button>
          </div>
          <div className="cashier-table-wrap">
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
                {suppliers.map((supplier) => (
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
                        onClick={() => window.alert(`${supplier.name} supplier details`)}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {section === 'reports' && <Reports />}
      {section === 'staff' && (
        <section className="cashier-panel cashier-list-panel">
          <div className="cashier-panel__heading">
            <div>
              <h3>Staff accounts</h3>
              <p>Example roles and shift availability.</p>
            </div>
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() =>
                window.alert(
                  'Staff invitations will be available when authentication is connected.',
                )
              }
            >
              Invite staff <span>＋</span>
            </button>
          </div>
          <div className="cashier-table-wrap">
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Role</th>
                  <th>Shift status</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.name}>
                    <td>
                      <span className="cashier-avatar cashier-avatar--table">
                        {person.initials}
                      </span>
                      <strong>{person.name}</strong>
                    </td>
                    <td>{person.role}</td>
                    <td>
                      <StatusBadge value={person.status} />
                    </td>
                    <td>
                      <button
                        className="cashier-view-button"
                        type="button"
                        onClick={() =>
                          window.alert('Staff access controls will be connected to authentication.')
                        }
                      >
                        Manage access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {section === 'settings' && (
        <section className="cashier-panel settings-form">
          <p className="demo-note">Settings are saved locally in this browser for preview only.</p>
          <label>
            Pharmacy name
            <input defaultValue="Dagohoy Pharmacy" />
          </label>
          <label>
            Contact number
            <input defaultValue="+63 2 8123 4567" />
          </label>
          <label>
            Address
            <input defaultValue="Dagohoy Street, Manila, Philippines" />
          </label>
          <label>
            Low-stock alert threshold
            <input type="number" min="1" defaultValue="15" />
          </label>
          <button
            className="cashier-primary-action"
            type="button"
            onClick={() => {
              setSaved(true);
              window.setTimeout(() => setSaved(false), 2500);
            }}
          >
            Save changes
          </button>
          {saved && (
            <span className="save-confirmation" role="status">
              Saved in this browser.
            </span>
          )}
        </section>
      )}
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function InventoryForm({
  product,
  onClose,
  onSave,
}: {
  product: InventoryProduct | null;
  onClose: () => void;
  onSave: (product: InventoryProduct) => void;
}) {
  const [name, setName] = useState(product?.product ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [detail, setDetail] = useState(product?.detail ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'Tablet');
  const [price, setPrice] = useState(product ? product.price.replace(/[₱,]/g, '') : '');
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Math.max(0, Number(stock));
    onSave({
      barcode,
      product: name.trim(),
      detail: detail.trim(),
      unit,
      price: `₱${Number(price).toFixed(2)}`,
      stock: quantity,
      status: stockStatus(quantity),
    });
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
      <CashierPageHeader
        eyebrow="Owner workspace · Today"
        title="Good morning, Ana"
        description="Your pharmacy at a glance. Here are the items that need your attention."
        action={
          <Link className="cashier-primary-action" to="/cashier/pos">
            Start a sale <CashierIcon name="arrow" />
          </Link>
        }
      />
      <div className="cashier-summary-grid">
        <Summary label="Sales today" value={money(18460.5)} detail="Demo data · 24 transactions" />
        <Summary label="Transactions" value="24" detail="Sample register activity" />
        <Summary label="Inventory value" value={money(283450)} detail="Illustrative retail value" />
        <Summary label="Needs attention" value="15 items" detail="Sample low-stock alerts" />
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
          <div className="cashier-table-wrap">
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
                  .filter((product) => product.stock < 20)
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
