import { useEffect, useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { downloadXlsx } from '../../lib/xlsx';
import { ThermalReceipt } from '../../components/cashier/ThermalReceipt';
import { listSalesBetween } from '../../services/storeApi';

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
  cashier?: string;
  amountPaid?: number;
  change?: number;
  creditBalance?: number;
  noChargeReason?: string;
  voidReason?: string;
  voidedAt?: string;
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
  const [savedSales] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[];
    } catch {
      return [];
    }
  });
  /** Sales of the custom range, from the server (the browser keeps only the recent ones). */
  const [rangeSales, setRangeSales] = useState<Sale[]>([]);
  const [rangeNote, setRangeNote] = useState('');
  const toRecord = (sale: Sale) => ({
    ...sale,
    dateValue: sale.date,
    amount: Number(sale.total ?? 0),
    date: new Date(sale.date).toLocaleString('en-PH'),
    total: `₱${Number(sale.total ?? 0).toFixed(2)}`,
  });
  const allRecords = useMemo(() => savedSales.map(toRecord), [savedSales]);
  const rangeRecords = useMemo(() => rangeSales.map(toRecord), [rangeSales]);

  useEffect(() => {
    if (view !== 'custom') return;
    const from = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
    const to = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
    let current = true;
    setRangeNote('Loading sales…');
    listSalesBetween(from, to)
      .then((list) => {
        if (!current) return;
        setRangeSales(list as Sale[]);
        setRangeNote('');
      })
      .catch((error: unknown) => {
        if (!current) return;
        setRangeSales([]);
        setRangeNote(error instanceof Error ? error.message : 'Could not load the sales.');
      });
    return () => {
      current = false;
    };
  }, [view, rangeFrom, rangeTo]);
  const groups = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString()).getTime();
    const weekCutoff = Date.now() - 7 * 86400000;
    const monthCutoff = Date.now() - 30 * 86400000;
    const kept = allRecords.filter((sale) => sale.status !== 'Voided');
    return {
      today: kept.filter((sale) => new Date(sale.dateValue).getTime() >= startOfToday),
      week: kept.filter((sale) => new Date(sale.dateValue).getTime() >= weekCutoff),
      month: kept.filter((sale) => new Date(sale.dateValue).getTime() >= monthCutoff),
      custom: rangeRecords.filter((sale) => sale.status !== 'Voided'),
      gcash: allRecords.filter(isPendingGcash),
      voided: allRecords.filter((sale) => sale.status === 'Voided'),
    };
  }, [allRecords, rangeRecords]);
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
      about: 'Sales from the last 7 days. Use the search to find one sale record.',
    },
    {
      key: 'month',
      icon: 'reports',
      title: 'Last 30 days',
      hint: 'Sales this month',
      tone: 'teal',
      count: groups.month.length,
      about: 'Sales from the last 30 days. Use the search to find one sale record.',
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
      hint: 'Cancelled sales',
      tone: 'rose',
      count: groups.voided.length,
      about: 'Sales that were voided. Their items went back on the shelf.',
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
      `Generated ${generated}${query.trim() ? ` · record search “${query.trim()}”` : ''}`,
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
          'Record no.',
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
              {rangeNote && <p role="status">{rangeNote}</p>}
            </div>
          )}
          <div className="cashier-list-toolbar">
            <label className="cashier-search-field cashier-search-field--wide">
              <CashierIcon name="search" />
              <input
                type="search"
                placeholder="Search record number"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          {records.length === 0 ? (
            <p className="register-empty">
              {query.trim()
                ? `No record matches “${query.trim()}” here.`
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
                    <th>Record #</th>
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
                            setSelected(
                              savedSales.find((sale) => sale.receipt === transaction.receipt) ??
                                null,
                            )
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
          <section className="pos-payment-modal receipt-view" aria-labelledby="receipt-view-title">
            <button
              className="pos-modal-close"
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close sales record"
            >
              ×
            </button>
            <div className="receipt-view__bar">
              <p className="eyebrow">Transaction</p>
              <h2 id="receipt-view-title">{selected.receipt}</h2>
              <div className="receipt-view__tags">
                <StatusBadge value={selected.status} />
                <span>{selected.payment}</span>
                <span>{new Date(selected.date).toLocaleString('en-PH')}</span>
              </div>
            </div>

            {selected.status === 'Voided' && (
              <p className="receipt-view__note is-void">
                Voided
                {selected.voidedAt
                  ? ` on ${new Date(selected.voidedAt).toLocaleString('en-PH')}`
                  : ''}
                {selected.voidReason ? `: ${selected.voidReason}` : ''}. It does not count as a
                sale.
              </p>
            )}
            {isPendingGcash(selected) && (
              <p className="receipt-view__note is-pending">
                GCash not confirmed yet. Check the pharmacy GCash app for reference{' '}
                {selected.gcashReference ? `…${selected.gcashReference}` : '(none saved)'}.
              </p>
            )}
            {selected.payment === 'Credit' &&
              selected.status !== 'Voided' &&
              Number(selected.creditBalance ?? 0) > 0 && (
                <p className="receipt-view__note is-pending">
                  {selected.customer || 'The customer'} still owes ₱
                  {Number(selected.creditBalance).toFixed(2)}. Collect it in Credit accounts.
                </p>
              )}

            <div className="receipt-view__paper">
              <ThermalReceipt
                data={{
                  receipt: selected.receipt,
                  date: selected.date,
                  cashier: selected.cashier,
                  customer: selected.customer,
                  payment: selected.payment,
                  lines: selected.lines ?? [],
                  subtotal: Number(selected.subtotal ?? selected.total ?? 0),
                  discount: Number(selected.discount ?? 0),
                  total: Number(selected.total ?? 0),
                  amountPaid: selected.amountPaid,
                  change: selected.change,
                  gcashReference: selected.gcashReference,
                  paymentStatus: selected.paymentStatus,
                  creditBalance: selected.creditBalance,
                  noChargeReason: selected.noChargeReason,
                  status: selected.status,
                  voidReason: selected.voidReason,
                  voidedAt: selected.voidedAt,
                }}
              />
            </div>

            <div className="pos-done__actions">
              <button className="pos-done__close" type="button" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
