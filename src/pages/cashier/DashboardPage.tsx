import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { cashierProfile, dashboardSummary, recentTransactions } from '../../data/cashierMockData';

export function CashierDashboardPage() {
  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Today · October 15, 2026"
        title={`Good morning, ${cashierProfile.shortName}`}
        description="Cashier • Dagohoy Pharmacy"
        action={
          <Link className="cashier-primary-action" to="/cashier/pos">
            Open POS <CashierIcon name="arrow" />
          </Link>
        }
      />

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
                {recentTransactions.map((transaction) => (
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
            <input type="search" placeholder="Search or scan barcode" />
          </label>
          <Link to="/cashier/products">
            Open product lookup <CashierIcon name="arrow" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
