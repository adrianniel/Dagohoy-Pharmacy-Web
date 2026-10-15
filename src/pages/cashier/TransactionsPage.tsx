import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { transactionHistory } from '../../data/cashierMockData';

export function CashierTransactionsPage() {
  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Sales history"
        title="Transactions"
        description="Review completed sales recorded during cashier operations."
      />
      <section className="cashier-panel cashier-list-panel">
        <div className="cashier-list-toolbar">
          <label className="cashier-search-field cashier-search-field--wide">
            <CashierIcon name="search" />
            <input type="search" placeholder="Search receipt number" />
          </label>
          <button className="cashier-filter-button" type="button">
            <CashierIcon name="calendar" /> Today <span>⌄</span>
          </button>
        </div>
        <div className="cashier-table-wrap">
          <table className="cashier-table cashier-transactions-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date / Time</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {transactionHistory.map((transaction) => (
                <tr key={transaction.receipt}>
                  <td>
                    <strong>{transaction.receipt}</strong>
                  </td>
                  <td>{transaction.date}</td>
                  <td>{transaction.items}</td>
                  <td>
                    <strong>{transaction.total}</strong>
                  </td>
                  <td>{transaction.payment}</td>
                  <td>
                    <StatusBadge value={transaction.status} />
                  </td>
                  <td>
                    <button className="cashier-view-button" type="button">
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cashier-table-footer">
          <span>Showing today's mock transactions</span>
          <span>Refund and void actions are not available.</span>
        </div>
      </section>
    </div>
  );
}
