import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { cashierProfile, dashboardSummary, recentTransactions } from '../../data/cashierMockData';
import { getInventory } from '../../data/inventoryStore';

const SALES_KEY = 'dagohoy_demo_sales';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

export function CashierDashboardPage() {
  const [query, setQuery] = useState('');
  const demoSales = JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Array<{
    receipt: string;
    date: string;
    items: number;
    total: number;
    payment: string;
    status: string;
  }>;
  const matches = useMemo(
    () =>
      getInventory()
        .filter((product) =>
          `${product.product} ${product.detail} ${product.barcode}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .slice(0, 4),
    [query],
  );
  const today = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'full',
    timeZone: 'Asia/Manila',
  }).format(new Date());
  const latestTransactions = demoSales.length
    ? demoSales.slice(0, 4).map((sale) => ({
        receipt: sale.receipt,
        time: new Date(sale.date).toLocaleTimeString('en-PH', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        items: sale.items,
        total: money(sale.total),
        payment: sale.payment,
        status: sale.status,
      }))
    : recentTransactions;
  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow={today}
        title={`Good morning, ${cashierProfile.shortName}`}
        description="Cashier • Dagohoy Pharmacy"
        action={
          <Link className="cashier-primary-action" to="/cashier/pos">
            Open POS <CashierIcon name="arrow" />
          </Link>
        }
      />

      <p className="demo-note dashboard-demo-note">
        Dashboard figures are sample data until live pharmacy sales are connected.
      </p>
      <section className="cashier-summary-grid" aria-label="Today's cashier summary">
        {dashboardSummary.map((summary) => (
          <article
            className={`cashier-summary-card cashier-summary-card--${summary.tone}`}
            key={summary.label}
          >
            <p>{summary.label}</p>
            <strong>{summary.value}</strong>
            <span>{summary.detail}</span>
          </article>
        ))}
      </section>

      <div className="cashier-dashboard-grid">
        <section className="cashier-panel cashier-panel--transactions">
          <div className="cashier-panel__heading">
            <div>
              <h3>Recent transactions</h3>
              <p>Latest sales completed during your shift.</p>
            </div>
            <Link to="/cashier/transactions">View all</Link>
          </div>
          <div className="cashier-table-wrap">
            <table className="cashier-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Time</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {latestTransactions.map((transaction) => (
                  <tr key={transaction.receipt}>
                    <td>
                      <strong>{transaction.receipt}</strong>
                    </td>
                    <td>{transaction.time}</td>
                    <td>{transaction.items}</td>
                    <td>
                      <strong>{transaction.total}</strong>
                    </td>
                    <td>{transaction.payment}</td>
                    <td>
                      <StatusBadge value={transaction.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="cashier-panel cashier-quick-lookup">
          <span className="cashier-panel-icon">
            <CashierIcon name="search" />
          </span>
          <h3>Quick product lookup</h3>
          <p>Check a product, price, or available stock without leaving the dashboard.</p>
          <label className="cashier-search-field">
            <CashierIcon name="search" />
            <input
              type="search"
              placeholder="Search or scan barcode"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {query && (
            <div className="dashboard-lookup-results">
              {matches.length ? (
                matches.map((product) => (
                  <div key={product.barcode}>
                    <span>
                      <strong>{product.product}</strong>
                      <small>
                        {product.barcode} · {product.stock} available
                      </small>
                    </span>
                    <b>{product.price}</b>
                  </div>
                ))
              ) : (
                <span>No matching products.</span>
              )}
            </div>
          )}
          <Link to="/cashier/products">
            Open product lookup <CashierIcon name="arrow" />
          </Link>
        </aside>
      </div>
      <Link className="cashier-drawer-shortcut" to="/cashier/register">
        <CashierIcon name="register" /> Manage cash drawer <CashierIcon name="arrow" />
      </Link>
    </div>
  );
}
