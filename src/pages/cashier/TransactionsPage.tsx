import { useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { transactionHistory } from '../../data/cashierMockData';
import { downloadXlsx } from '../../lib/xlsx';

const SALES_KEY = 'dagohoy_demo_sales';
type Sale = {
  receipt: string;
  date: string;
  items: number;
  total: number;
  subtotal?: number;
  discount?: number;
  payment: string;
  status: string;
  customer?: string;
  gcashReference?: string;
  paymentStatus?: string;
  lines?: Array<{ product: string; quantity: number; unitPrice: number }>;
};

type TransactionView = 'today' | 'week' | 'month' | 'custom' | 'gcash' | 'voided';

const VIEW_LABELS: Record<TransactionView, string> = {
  today: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  custom: 'Custom range',
  gcash: 'Pending GCash',
  voided: 'Voided sales',
};

/** Local calendar date, YYYY-MM-DD. */
const localDay = (value: Date | string | number) => new Date(value).toLocaleDateString('en-CA');

const isPendingGcash = (sale: { payment: string; status: string; paymentStatus?: string }) =>
  sale.payment === 'GCash' &&
  sale.status !== 'Voided' &&
  (sale.status === 'Pending GCash' ||
    (sale.paymentStatus !== undefined && sale.paymentStatus !== 'Paid'));

function readPharmacyName() {
  try {
    const settings = JSON.parse(localStorage.getItem('dagohoy_demo_pharmacy_settings') ?? '{}') as {
      name?: string;
    };
    return settings.name?.trim() || 'Dagohoy Pharmacy';
  } catch {
    return 'Dagohoy Pharmacy';
  }
}

export function CashierTransactionsPage() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<TransactionView>('today');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [rangeFrom, setRangeFrom] = useState(() => {
    const now = new Date();
    return localDay(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [rangeTo, setRangeTo] = useState(() => localDay(Date.now()));
  const [demoSales] = useState(() => JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[]);
  const allRecords = useMemo(
    () => [
      ...demoSales.map((sale) => ({
        ...sale,
        dateValue: sale.date,
        amount: Number(sale.total ?? 0),
        date: new Date(sale.date).toLocaleString('en-PH'),
        total: `₱${Number(sale.total ?? 0).toFixed(2)}`,
      })),
      ...transactionHistory.map((sale) => ({
        ...sale,
        lines: undefined,
        subtotal: undefined,
        discount: undefined,
        customer: undefined,
        gcashReference: undefined,
        paymentStatus: undefined,
        dateValue: new Date(sale.date.replace(' · ', ' ')).toISOString(),
        amount: Number(sale.total.replace(/[₱,]/g, '')),
        total: sale.total,
      })),
    ],
    [demoSales],
  );
  const groups = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString()).getTime();
    const weekCutoff = Date.now() - 7 * 86400000;
    const monthCutoff = Date.now() - 30 * 86400000;
    const kept = allRecords.filter((sale) => sale.status !== 'Voided');
    const from = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
    const to = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
    return {
      today: kept.filter((sale) => new Date(sale.dateValue).getTime() >= startOfToday),
      week: kept.filter((sale) => new Date(sale.dateValue).getTime() >= weekCutoff),
      month: kept.filter((sale) => new Date(sale.dateValue).getTime() >= monthCutoff),
      custom: kept.filter((sale) => {
        const day = localDay(sale.dateValue);
        return day >= from && day <= to;
      }),
      gcash: allRecords.filter(isPendingGcash),
      voided: allRecords.filter((sale) => sale.status === 'Voided'),
    };
  }, [allRecords, rangeFrom, rangeTo]);
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
      key: 'month',
      icon: 'reports',
      title: 'Last 30 days',
      hint: 'Sales this month',
      tone: 'teal',
      count: groups.month.length,
      about: 'Sales from the last 30 days. Use the search to find one receipt.',
    },
    {
      key: 'custom',
      icon: 'calendar',
      title: 'Custom',
      hint: 'Pick the dates',
      tone: 'slate',
      count: groups.custom.length,
      about: 'Sales between two dates you pick, both days included.',
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

  /** The date range the open view covers, in words, for the export title. */
  function rangeLabel() {
    const today = localDay(Date.now());
    switch (view) {
      case 'today':
        return today;
      case 'week':
        return `${localDay(Date.now() - 7 * 86400000)} to ${today}`;
      case 'month':
        return `${localDay(Date.now() - 30 * 86400000)} to ${today}`;
      case 'custom':
        return rangeFrom <= rangeTo ? `${rangeFrom} to ${rangeTo}` : `${rangeTo} to ${rangeFrom}`;
      default:
        return 'All dates';
    }
  }

  function exportExcel() {
    const generated = new Date().toLocaleString('en-PH');
    const title = [
      readPharmacyName(),
      `Transactions: ${VIEW_LABELS[view]} (${rangeLabel()})`,
      `Generated ${generated}${query.trim() ? ` · receipt search “${query.trim()}”` : ''}`,
    ];
    const kept = records.filter((sale) => sale.status !== 'Voided');

    const itemTotals = new Map<string, { quantity: number; amount: number }>();
    for (const sale of kept) {
      for (const line of sale.lines ?? []) {
        const row = itemTotals.get(line.product) ?? { quantity: 0, amount: 0 };
        row.quantity += line.quantity;
        row.amount += line.quantity * line.unitPrice;
        itemTotals.set(line.product, row);
      }
    }
    const dayTotals = new Map<string, { count: number; total: number }>();
    for (const sale of kept) {
      const day = localDay(sale.dateValue);
      const row = dayTotals.get(day) ?? { count: 0, total: 0 };
      row.count += 1;
      row.total += sale.amount;
      dayTotals.set(day, row);
    }

    downloadXlsx(`dagohoy-transactions-${view}-${localDay(Date.now())}.xlsx`, [
      {
        name: 'Transactions',
        title,
        header: [
          'Receipt',
          'Date',
          'Time',
          'Payment',
          'Items',
          'Subtotal',
          'Discount',
          'Total',
          'Status',
          'Customer',
          'GCash ref',
        ],
        rows: records.map((sale) => {
          const when = new Date(sale.dateValue);
          return [
            sale.receipt,
            localDay(when),
            when.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
            sale.payment,
            Number(sale.items ?? 0),
            sale.subtotal ?? sale.amount,
            sale.discount ?? 0,
            sale.amount,
            sale.status,
            sale.customer ?? '',
            sale.gcashReference ?? '',
          ];
        }),
        widths: [16, 12, 10, 12, 8, 12, 10, 12, 14, 20, 14],
      },
      {
        name: 'Items sold',
        title,
        header: ['Product', 'Qty', 'Amount'],
        rows: [...itemTotals.entries()]
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([product, row]) => [product, row.quantity, Math.round(row.amount * 100) / 100]),
        widths: [32, 8, 12],
      },
      {
        name: 'By day',
        title,
        header: ['Date', 'Sales', 'Total'],
        rows: [...dayTotals.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([day, row]) => [day, row.count, Math.round(row.total * 100) / 100]),
        widths: [12, 8, 12],
      },
    ]);
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
            onClick={exportExcel}
            disabled={!records.length}
          >
            Export Excel
          </button>
        }
      >
        <section className="cashier-panel cashier-list-panel">
          {view === 'custom' && (
            <div className="duty-reports__filters">
              <label>
                From
                <input
                  type="date"
                  value={rangeFrom}
                  max={rangeTo}
                  onChange={(event) => setRangeFrom(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom}
                  onChange={(event) => setRangeTo(event.target.value)}
                />
              </label>
            </div>
          )}
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
