import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadXlsx } from '../../lib/xlsx';

/*
 * Monthly sales report (draft) for the owner to show when BIR checks the store's sales.
 * One line per day of the month, every day listed even with no sales, plus month totals
 * and the list of receipts. Exports to Excel and saves as PDF through the print dialog.
 * It is a sales summary from this system, not an official BIR form.
 */

type StoredSale = {
  receipt: string;
  date: string;
  payment?: string;
  status?: string;
  items?: number;
  total?: number;
  subtotal?: number;
  discount?: number;
  customer?: string;
};

type DayRow = {
  date: string;
  receipts: number;
  first: string;
  last: string;
  gross: number;
  discounts: number;
  net: number;
  cash: number;
  gcash: number;
  credit: number;
  voidedCount: number;
  voidedTotal: number;
  noChargeValue: number;
};

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const round = (amount: number) => Math.round(amount * 100) / 100;

const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

function readSales(): StoredSale[] {
  try {
    return JSON.parse(localStorage.getItem('dagohoy_demo_sales') ?? '[]') as StoredSale[];
  } catch {
    return [];
  }
}

function readStore() {
  try {
    const settings = JSON.parse(localStorage.getItem('dagohoy_demo_pharmacy_settings') ?? '{}') as {
      name?: string;
      address?: string;
      phone?: string;
    };
    return {
      name: settings.name?.trim() || 'Dagohoy Pharmacy',
      address: settings.address?.trim() || '',
      phone: settings.phone?.trim() || '',
    };
  } catch {
    return { name: 'Dagohoy Pharmacy', address: '', phone: '' };
  }
}

function monthLabel(month: string) {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

function buildReport(month: string) {
  const [year, index] = month.split('-').map(Number);
  const daysInMonth = new Date(year, index, 0).getDate();
  const inMonth = readSales()
    .filter((sale) => localDay(sale.date).startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));

  const days: DayRow[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const onDay = inMonth.filter((sale) => localDay(sale.date) === date);
    // A sale counts when it was not voided and money was asked for (no-charge slips are separate).
    const counted = onDay.filter(
      (sale) => sale.status !== 'Voided' && sale.payment !== 'No charge',
    );
    const voided = onDay.filter((sale) => sale.status === 'Voided');
    const noCharge = onDay.filter(
      (sale) => sale.status !== 'Voided' && sale.payment === 'No charge',
    );
    const sum = (list: StoredSale[], pick: (sale: StoredSale) => number) =>
      round(list.reduce((total, sale) => total + pick(sale), 0));
    const byPayment = (method: string) =>
      sum(
        counted.filter((sale) => sale.payment === method),
        (sale) => Number(sale.total ?? 0),
      );
    days.push({
      date,
      receipts: counted.length,
      first: counted[0]?.receipt ?? '',
      last: counted[counted.length - 1]?.receipt ?? '',
      gross: sum(counted, (sale) => Number(sale.subtotal ?? sale.total ?? 0)),
      discounts: sum(counted, (sale) => Number(sale.discount ?? 0)),
      net: sum(counted, (sale) => Number(sale.total ?? 0)),
      cash: byPayment('Cash'),
      gcash: byPayment('GCash'),
      credit: byPayment('Credit'),
      voidedCount: voided.length,
      voidedTotal: sum(voided, (sale) => Number(sale.total ?? 0)),
      noChargeValue: sum(noCharge, (sale) => Number(sale.subtotal ?? 0)),
    });
  }

  const total = (key: keyof DayRow) =>
    round(days.reduce((sum, day) => sum + Number(day[key] || 0), 0));
  const totals = {
    receipts: total('receipts'),
    gross: total('gross'),
    discounts: total('discounts'),
    net: total('net'),
    cash: total('cash'),
    gcash: total('gcash'),
    credit: total('credit'),
    voidedCount: total('voidedCount'),
    voidedTotal: total('voidedTotal'),
    noChargeValue: total('noChargeValue'),
  };
  const daysWithSales = days.filter((day) => day.receipts > 0).length;
  return { days, totals, receipts: inMonth, daysWithSales };
}

function MonthlyDocument({ month }: { month: string }) {
  const store = readStore();
  const { days, totals, daysWithSales } = useMemo(() => buildReport(month), [month]);
  return (
    <article className="shift-doc monthly-doc">
      <header className="shift-doc__head">
        <div>
          <strong>{store.name}</strong>
          {store.address && <span>{store.address}</span>}
          {store.phone && <span>Tel: {store.phone}</span>}
        </div>
        <div className="shift-doc__title">
          <h2>Monthly sales report</h2>
          <span>{monthLabel(month)} · DRAFT</span>
        </div>
      </header>
      <div className="shift-doc__stats">
        <div>
          <span>Net sales</span>
          <strong>{money(totals.net)}</strong>
        </div>
        <div>
          <span>Receipts</span>
          <strong>{totals.receipts}</strong>
        </div>
        <div>
          <span>Discounts</span>
          <strong>{money(totals.discounts)}</strong>
        </div>
        <div>
          <span>Days with sales</span>
          <strong>{daysWithSales}</strong>
        </div>
      </div>
      <table className="shift-doc__table monthly-doc__table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Receipts</th>
            <th>First no.</th>
            <th>Last no.</th>
            <th>Gross</th>
            <th>Discounts</th>
            <th>Net sales</th>
            <th>Cash</th>
            <th>GCash</th>
            <th>Credit</th>
            <th>Voided</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date} className={day.receipts ? '' : 'is-empty'}>
              <td>{day.date}</td>
              <td>{day.receipts}</td>
              <td>{day.first}</td>
              <td>{day.last}</td>
              <td>{money(day.gross)}</td>
              <td>{money(day.discounts)}</td>
              <td>
                <strong>{money(day.net)}</strong>
              </td>
              <td>{money(day.cash)}</td>
              <td>{money(day.gcash)}</td>
              <td>{money(day.credit)}</td>
              <td>{day.voidedCount ? `${day.voidedCount} (${money(day.voidedTotal)})` : '0'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>{totals.receipts}</td>
            <td />
            <td />
            <td>{money(totals.gross)}</td>
            <td>{money(totals.discounts)}</td>
            <td>{money(totals.net)}</td>
            <td>{money(totals.cash)}</td>
            <td>{money(totals.gcash)}</td>
            <td>{money(totals.credit)}</td>
            <td>
              {totals.voidedCount} ({money(totals.voidedTotal)})
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="shift-doc__missing">
        Net sales = gross sales minus discounts. Voided receipts and no-charge slips (
        {money(totals.noChargeValue)} worth) are not counted as sales. Draft from this system's
        records, to be checked by the owner or bookkeeper. Not an official BIR form.
      </p>
      <footer className="shift-doc__sign">
        <div>
          <span />
          Prepared by
        </div>
        <div>
          <span />
          Checked by (owner)
        </div>
      </footer>
    </article>
  );
}

/** The Reports panel: month picker, daily table, Excel export and Save as PDF. */
export function MonthlySalesReport() {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [printing, setPrinting] = useState(false);
  const { days, totals, receipts, daysWithSales } = useMemo(() => buildReport(month), [month]);
  const store = readStore();

  useEffect(() => {
    if (!printing) return;
    const previousTitle = document.title;
    document.title = `Monthly sales ${month}`;
    document.body.classList.add('print-report-doc');
    const done = () => {
      document.body.classList.remove('print-report-doc');
      document.title = previousTitle;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    // A short timer (not requestAnimationFrame) so printing also starts when the tab is not drawing.
    const timer = window.setTimeout(() => window.print(), 60);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('print-report-doc');
      document.title = previousTitle;
    };
  }, [printing, month]);

  function exportExcel() {
    const title = [
      store.name,
      `Monthly sales report: ${monthLabel(month)} (draft, not an official BIR form)`,
      `Generated ${new Date().toLocaleString('en-PH')}`,
    ];
    downloadXlsx(`dagohoy-monthly-sales-${month}.xlsx`, [
      {
        name: 'Daily sales',
        title,
        header: [
          'Date',
          'Receipts',
          'First receipt no.',
          'Last receipt no.',
          'Gross sales',
          'Discounts',
          'Net sales',
          'Cash',
          'GCash',
          'Credit',
          'Voided receipts',
          'Voided amount',
          'No-charge value',
        ],
        rows: [
          ...days.map((day) => [
            day.date,
            day.receipts,
            day.first,
            day.last,
            day.gross,
            day.discounts,
            day.net,
            day.cash,
            day.gcash,
            day.credit,
            day.voidedCount,
            day.voidedTotal,
            day.noChargeValue,
          ]),
          [
            'TOTAL',
            totals.receipts,
            '',
            '',
            totals.gross,
            totals.discounts,
            totals.net,
            totals.cash,
            totals.gcash,
            totals.credit,
            totals.voidedCount,
            totals.voidedTotal,
            totals.noChargeValue,
          ],
        ],
        widths: [12, 10, 16, 16, 13, 12, 13, 12, 12, 12, 10, 13, 13],
      },
      {
        name: 'Receipts',
        title,
        header: [
          'Receipt',
          'Date',
          'Time',
          'Payment',
          'Items',
          'Gross',
          'Discount',
          'Total',
          'Status',
        ],
        rows: receipts.map((sale) => [
          sale.receipt,
          localDay(sale.date),
          new Date(sale.date).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
          sale.payment ?? '',
          Number(sale.items ?? 0),
          Number(sale.subtotal ?? sale.total ?? 0),
          Number(sale.discount ?? 0),
          Number(sale.total ?? 0),
          sale.status ?? 'Completed',
        ]),
        widths: [16, 12, 10, 11, 8, 12, 10, 12, 14],
      },
    ]);
  }

  return (
    <>
      <p className="stock-index__warn">
        Draft. It adds up the sales saved in this system for the month. Ask the owner or bookkeeper
        to check it before showing it to BIR. It is not an official BIR form.
      </p>
      <div className="duty-reports__filters">
        <label>
          Month
          <input
            type="month"
            value={month}
            max={new Date().toLocaleDateString('en-CA').slice(0, 7)}
            onChange={(event) => event.target.value && setMonth(event.target.value)}
          />
        </label>
        <button className="shift-report-modal__pdf" type="button" onClick={exportExcel}>
          Export Excel
        </button>
        <button
          className="shift-report-modal__close"
          type="button"
          onClick={() => setPrinting(true)}
        >
          Save as PDF
        </button>
      </div>
      <div className="stock-index__chips">
        <span>
          Net sales <b>{money(totals.net)}</b>
        </span>
        <span>
          Receipts <b>{totals.receipts}</b>
        </span>
        <span>
          Days with sales <b>{daysWithSales}</b>
        </span>
        <span className={totals.voidedCount ? 'is-low' : undefined}>
          Voided <b>{totals.voidedCount}</b>
        </span>
      </div>
      <div className="cashier-table-wrap" role="region" aria-label="Daily sales" tabIndex={0}>
        <table className="cashier-table monthly-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipts</th>
              <th>Receipt nos.</th>
              <th>Gross</th>
              <th>Discounts</th>
              <th>Net sales</th>
              <th>Cash</th>
              <th>GCash</th>
              <th>Credit</th>
              <th>Voided</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className={day.receipts ? '' : 'is-empty'}>
                <td>
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </td>
                <td>{day.receipts}</td>
                <td className="cashier-mono">
                  {day.first
                    ? day.first === day.last
                      ? day.first
                      : `${day.first} – ${day.last}`
                    : '—'}
                </td>
                <td>{money(day.gross)}</td>
                <td>{money(day.discounts)}</td>
                <td>
                  <strong>{money(day.net)}</strong>
                </td>
                <td>{money(day.cash)}</td>
                <td>{money(day.gcash)}</td>
                <td>{money(day.credit)}</td>
                <td>{day.voidedCount || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{totals.receipts}</td>
              <td />
              <td>{money(totals.gross)}</td>
              <td>{money(totals.discounts)}</td>
              <td>{money(totals.net)}</td>
              <td>{money(totals.cash)}</td>
              <td>{money(totals.gcash)}</td>
              <td>{money(totals.credit)}</td>
              <td>{totals.voidedCount}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {printing &&
        createPortal(
          <div id="report-print-root">
            <MonthlyDocument month={month} />
          </div>,
          document.body,
        )}
    </>
  );
}
