import { useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
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

type TransactionView = 'today' | 'week' | 'gcash' | 'voided';

const isPendingGcash = (sale: { payment: string; status: string; paymentStatus?: string }) =>
  sale.payment === 'GCash' &&
  sale.status !== 'Voided' &&
  (sale.status === 'Pending GCash' ||
    (sale.paymentStatus !== undefined && sale.paymentStatus !== 'Paid'));

export function CashierTransactionsPage() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<TransactionView>('today');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [demoSales] = useState(() => JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[]);
  const allRecords = useMemo(
    () => [
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
    ],
    [demoSales],
  );
  const groups = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString()).getTime();
    const weekCutoff = Date.now() - 7 * 86400000;
    const kept = allRecords.filter((sale) => sale.status !== 'Voided');
    return {
      today: kept.filter((sale) => new Date(sale.dateValue).getTime() >= startOfToday),
      week: kept.filter((sale) => new Date(sale.dateValue).getTime() >= weekCutoff),
      gcash: allRecords.filter(isPendingGcash),
      voided: allRecords.filter((sale) => sale.status === 'Voided'),
    };
  }, [allRecords]);
  const records = groups[view].filter((transaction) =>
    transaction.receipt.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const items: Array<ControlItem<TransactionView>> = [
    {
      key: 'today',
      icon: 'calendar',
      title: 'Today',
      hint: 'Sales made today',
      tone: 'forest',
      count: groups.today.length,
      about: 'Every sale made today, newest first. Voided sales are listed under Voided sales.',
    },
    {
      key: 'week',
      icon: 'transactions',
      title: 'Last 7 days',
      hint: 'Sales this week',
      tone: 'blue',
      count: groups.week.length,
      about: 'Sales from the last 7 days. Use the search to find one receipt.',
    },
    {
      key: 'gcash',
      icon: 'phone',
      title: 'Pending GCash',
      hint: 'Not confirmed yet',
      tone: 'amber',
      count: groups.gcash.length,
      alert: groups.gcash.length > 0,
      about:
        'GCash sales saved before the payment was confirmed. Check them in the pharmacy GCash app.',
    },
    {
      key: 'voided',
      icon: 'receipt',
      title: 'Voided sales',
      hint: 'Cancelled receipts',
      tone: 'rose',
      count: groups.voided.length,
      about: 'Receipts that were voided. Their items went back on the shelf.',
    },
  ];
  const activeItem = items.find((item) => item.key === view);

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
    link.download = `dagohoy-transactions-${view}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="cashier-page">
      <ControlDeck
        id="transactions"
        title="Transactions"
        subtitle="Pick which sales to see. The list opens in the card below."
        items={items}
        active={view}
        onSelect={setView}
      />
      <ControlPanel
        id="transactions"
        activeKey={view}
        title={activeItem?.title ?? 'Transactions'}
        about={activeItem?.about}
        actions={
          <button
            className="cashier-filter-button"
            type="button"
            onClick={exportCsv}
            disabled={!records.length}
          >
            Export CSV
          </button>
        }
      >
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
          </div>
          {records.length === 0 ? (
            <p className="register-empty">
              {query.trim()
                ? `No receipt matches “${query.trim()}” here.`
                : view === 'gcash'
                  ? 'No GCash payments waiting. Every GCash sale is confirmed.'
                  : view === 'voided'
                    ? 'No voided sales.'
                    : 'No sales in this period yet.'}
            </p>
          ) : (
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
          )}
          <div className="cashier-table-footer">
            <span>
              Showing {records.length} transaction{records.length === 1 ? '' : 's'}
            </span>
            <span>Live transactions are not connected to the pharmacy server.</span>
          </div>
        </section>
      </ControlPanel>{' '}
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
