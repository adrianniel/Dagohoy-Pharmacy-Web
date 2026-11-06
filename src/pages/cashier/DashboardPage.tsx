import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { dashboardSummary, recentTransactions } from '../../data/cashierMockData';

const SALES_KEY = 'dagohoy_demo_sales';
const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

export function CashierDashboardPage() {
  const demoSales = JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Array<{
    receipt: string;
    date: string;
    items: number;
    total: number;
    payment: string;
    status: string;
  }>;
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
      <div className="demo-note dashboard-demo-note">
        <span>Dashboard figures are sample data until live pharmacy sales are connected.</span>
        <Link className="cashier-view-button dashboard-pos-link" to="/cashier/pos">
          Open POS <CashierIcon name="arrow" />
        </Link>
      </div>
      <section
        className="cashier-summary-grid cashier-summary-grid--three"
        aria-label="Today's cashier summary"
      >
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

      <section className="cashier-panel cashier-panel--transactions">
        <div className="cashier-panel__heading">
          <div>
            <h3>Recent transactions</h3>
            <p>Latest sales completed during your shift.</p>
          </div>
          <Link to="/cashier/transactions">View all</Link>
        </div>
        <div
          className="cashier-table-wrap"
          role="region"
          aria-label="Recent transactions table"
          tabIndex={0}
        >
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
      <Link className="cashier-drawer-shortcut" to="/cashier/register">
        <CashierIcon name="register" /> Manage cash drawer <CashierIcon name="arrow" />
      </Link>
    </div>
  );
}
