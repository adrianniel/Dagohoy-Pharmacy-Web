import { useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { transactionHistory } from '../../data/cashierMockData';

const SALES_KEY = 'dagohoy_demo_sales';
type Sale = {
  receipt: string;
  date: string;
  items: number;
  total: number;
  payment: string;
  status: string;
};

export function CashierTransactionsPage() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [demoSales] = useState(() => JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[]);
  const records = useMemo(
    () =>
      [
        ...demoSales.map((sale) => ({
          receipt: sale.receipt,
          date: new Date(sale.date).toLocaleString('en-PH'),
          items: sale.items,
          total: `₱${sale.total.toFixed(2)}`,
          payment: sale.payment,
          status: sale.status,
        })),
        ...transactionHistory,
      ].filter((transaction) => transaction.receipt.toLowerCase().includes(query.toLowerCase())),
    [demoSales, query],
  );
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
            <input
              type="search"
              placeholder="Search receipt number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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
              {records.map((transaction) => (
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
                    <button
                      className="cashier-view-button"
                      type="button"
                      onClick={() =>
                        setSelected({
                          ...transaction,
                          date: transaction.date,
                          total: Number(transaction.total.replace(/[₱,]/g, '')),
                        })
                      }
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cashier-table-footer">
          <span>Showing {records.length} sample and local demo transactions</span>
          <span>Live transactions are not connected to the pharmacy server.</span>
        </div>
      </section>
      {selected && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="pos-payment-modal transaction-detail"
            aria-labelledby="transaction-detail-title"
          >
            <button
              className="pos-modal-close"
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close transaction details"
            >
              ×
            </button>
            <p className="eyebrow">Transaction detail</p>
            <h2 id="transaction-detail-title">{selected.receipt}</h2>
            <dl>
              <div>
                <dt>Date</dt>
                <dd>{selected.date}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{selected.items}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{selected.payment}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>₱{selected.total.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="pos-demo-disclaimer">
              Sample/demo record. Receipt and item-level details are not available until the sales
              API is connected.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
