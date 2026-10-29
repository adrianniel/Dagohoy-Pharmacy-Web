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
  gcashReference?: string;
  paymentStatus?: string;
  lines?: Array<{ product: string; quantity: number; unitPrice: number }>;
};

export function CashierTransactionsPage() {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('7');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [demoSales] = useState(() => JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[]);
  const records = useMemo(() => {
    const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * 86400000;
    return [
      ...demoSales.map((sale) => ({
        ...sale,
        dateValue: sale.date,
        date: new Date(sale.date).toLocaleString('en-PH'),
        total: `₱${sale.total.toFixed(2)}`,
      })),
      ...transactionHistory.map((sale) => ({
        ...sale,
        lines: undefined,
        gcashReference: undefined,
        paymentStatus: undefined,
        dateValue: new Date(sale.date.replace(' · ', ' ')).toISOString(),
        total: sale.total,
      })),
    ].filter(
      (transaction) =>
        transaction.receipt.toLowerCase().includes(query.toLowerCase()) &&
        new Date(transaction.dateValue).getTime() >= cutoff,
    );
  }, [demoSales, period, query]);
  function exportCsv() {
    const rows = [
      [
        'Receipt',
        'Date',
        'Items',
        'Total',
        'Payment',
        'Payment status',
        'GCash reference',
        'Status',
      ],
      ...records.map((item) => [
        item.receipt,
        item.date,
        String(item.items),
        item.total,
        item.payment,
        item.paymentStatus ?? '',
        item.gcashReference ?? '',
        item.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dagohoy-demo-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
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
          <label className="cashier-filter-button">
            <CashierIcon name="calendar" />
            <select
              aria-label="Transaction date range"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="1">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All dates</option>
            </select>
          </label>
          <button className="cashier-filter-button" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <div
          className="cashier-table-wrap"
          role="region"
          aria-label="Transactions table"
          tabIndex={0}
        >
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
                          lines: transaction.lines,
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
              {selected.payment === 'GCash' && (
                <>
                  <div>
                    <dt>GCash reference</dt>
                    <dd>{selected.gcashReference || '—'}</dd>
                  </div>
                  <div>
                    <dt>Manual payment status</dt>
                    <dd>{selected.paymentStatus || 'Unpaid'}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>₱{selected.total.toFixed(2)}</dd>
              </div>
            </dl>
            {selected.lines?.length ? (
              <div className="receipt-lines">
                <h3>Items sold</h3>
                {selected.lines.map((line, index) => (
                  <div key={`${line.product}-${index}`}>
                    <span>
                      {line.product} × {line.quantity}
                    </span>
                    <strong>₱{(line.quantity * line.unitPrice).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              className="cashier-view-button receipt-print-button"
              type="button"
              onClick={() => window.print()}
            >
              Print receipt
            </button>
            <p className="pos-demo-disclaimer">
              Sample/demo record only. Printing does not create a tax invoice or official receipt.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
