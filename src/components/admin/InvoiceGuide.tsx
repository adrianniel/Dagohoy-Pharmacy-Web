import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getInventory } from '../../data/inventoryStore';
import { downloadPdf } from '../../lib/pdf';
import { downloadXlsx } from '../../lib/xlsx';
import { listSalesBetween, type ApiSale } from '../../services/storeApi';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';

/*
 * Invoice guide: the day's real sales laid out like a page of the store's BIR sales invoice
 * booklet (Qty · Unit · Articles/Description · Unit Price · Amount, Total Sales, Less discount,
 * Total Amount Due), so the owner copies the numbers instead of guessing them. It only shows
 * sales recorded in the system; it never makes up entries. It is a guide, not an invoice.
 */

/** Item lines on one booklet page (between the header and Total Sales). */
const LINES_PER_PAGE = 11;
/** Sales from this amount may need their own invoice instead of the daily summary. */
const OWN_INVOICE_FROM = 500;

type Mode = 'items' | 'daily';
type Line = { qty: number; unit: string; description: string; unitPrice: number; amount: number };
type Page = { lines: Line[]; total: number; discount: number; due: number };
type Day = {
  date: string;
  pages: Page[];
  gross: number;
  discount: number;
  due: number;
  bigSales: ApiSale[];
};

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount,
  );
const round = (amount: number) => Math.round(amount * 100) / 100;
const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const longDate = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

/** Short unit words as written in the booklet. */
const UNIT_SHORT: Record<string, string> = {
  Tablet: 'tab',
  Capsule: 'cap',
  Bottle: 'bot',
  Sachet: 'sach',
  Tube: 'tube',
  Pack: 'pack',
  Box: 'box',
  Piece: 'pc',
};

function buildDays(sales: ApiSale[], mode: Mode): Day[] {
  const unitOf = new Map(getInventory().map((product) => [product.barcode, product.unit]));
  const byDay = new Map<string, ApiSale[]>();
  for (const sale of sales) {
    // Voided sales did not happen; a no-charge record is not a sale.
    if (sale.status === 'Voided' || sale.payment === 'No charge') continue;
    const day = localDay(sale.date);
    byDay.set(day, [...(byDay.get(day) ?? []), sale]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySales]) => {
      const gross = round(daySales.reduce((sum, sale) => sum + sale.subtotal, 0));
      const discount = round(daySales.reduce((sum, sale) => sum + sale.discount, 0));
      const due = round(gross - discount);

      let lines: Line[];
      if (mode === 'daily') {
        lines = [
          {
            qty: 1,
            unit: 'lot',
            description: `Sales for the day (${daySales.length} sale${daySales.length === 1 ? '' : 's'})`,
            unitPrice: gross,
            amount: gross,
          },
        ];
      } else {
        // One line per product and price, in the order first sold that day.
        const byItem = new Map<string, Line>();
        for (const sale of [...daySales].sort((a, b) => a.date.localeCompare(b.date))) {
          for (const line of sale.lines) {
            const key = `${line.product}|${line.unitPrice}`;
            const item = byItem.get(key) ?? {
              qty: 0,
              unit: UNIT_SHORT[unitOf.get(line.barcode) ?? ''] ?? 'pc',
              description: line.product,
              unitPrice: line.unitPrice,
              amount: 0,
            };
            item.qty += line.quantity;
            item.amount = round(item.amount + line.quantity * line.unitPrice);
            byItem.set(key, item);
          }
        }
        lines = [...byItem.values()];
      }

      // Each booklet page is its own invoice with its own total; the day's discount goes on the
      // last page so every page adds up.
      const pages: Page[] = [];
      for (let start = 0; start < lines.length; start += LINES_PER_PAGE) {
        const pageLines = lines.slice(start, start + LINES_PER_PAGE);
        const total = round(pageLines.reduce((sum, line) => sum + line.amount, 0));
        const last = start + LINES_PER_PAGE >= lines.length;
        const pageDiscount = last ? discount : 0;
        pages.push({
          lines: pageLines,
          total,
          discount: pageDiscount,
          due: round(total - pageDiscount),
        });
      }

      return {
        date,
        pages,
        gross,
        discount,
        due,
        bigSales: daySales.filter((sale) => sale.total >= OWN_INVOICE_FROM),
      };
    });
}

function InvoicePage({ day, page, index }: { day: Day; page: Page; index: number }) {
  const empty = Math.max(0, LINES_PER_PAGE - page.lines.length);
  return (
    <article className="invoice-page">
      <header className="invoice-page__head">
        <strong>SALES INVOICE</strong>
        <span>
          {day.pages.length > 1 ? `Page ${index + 1} of ${day.pages.length} for this day` : ''}
        </span>
      </header>
      <dl className="invoice-page__fields">
        <div>
          <dt>Sold to</dt>
          <dd>Various customers (daily sales)</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{longDate(day.date)}</dd>
        </div>
      </dl>
      <table className="invoice-page__table">
        <thead>
          <tr>
            <th>Qty.</th>
            <th>Unit</th>
            <th>Articles/Description</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {page.lines.map((line, row) => (
            <tr key={row}>
              <td>{line.qty}</td>
              <td>{line.unit}</td>
              <td>{line.description}</td>
              <td>{money(line.unitPrice)}</td>
              <td>{money(line.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: empty }, (_, row) => (
            <tr key={`empty-${row}`} className="is-empty">
              <td colSpan={5}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total Sales</td>
            <td>{money(page.total)}</td>
          </tr>
          <tr>
            <td colSpan={4}>Less: SC/PWD Discount</td>
            <td>{page.discount ? money(page.discount) : ''}</td>
          </tr>
          <tr className="is-due">
            <td colSpan={4}>TOTAL AMOUNT DUE</td>
            <td>{money(page.due)}</td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}

/** Owner Reports → Invoice guide: pick the dates, copy each page into the booklet. */
export function InvoiceGuide() {
  const today = new Date().toLocaleDateString('en-CA');
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [mode, setMode] = useState<Mode>('items');
  const [sales, setSales] = useState<ApiSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const pdfCopy = useRef<HTMLDivElement>(null);
  const days = useMemo(() => buildDays(sales, mode), [sales, mode]);
  const pageCount = days.reduce((sum, day) => sum + day.pages.length, 0);
  const totalDue = round(days.reduce((sum, day) => sum + day.due, 0));
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    listSalesBetween(start, end)
      .then((list) => current && setSales(list))
      .catch((error: unknown) => {
        if (!current) return;
        setSales([]);
        setLoadError(error instanceof Error ? error.message : 'Could not load the sales.');
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [start, end]);

  useEffect(() => {
    if (!saving) return;
    const timer = window.setTimeout(() => {
      if (!pdfCopy.current) return setSaving(false);
      downloadPdf(pdfCopy.current, `Invoice guide ${start} to ${end}`)
        .catch(() => window.alert('The PDF could not be made. Please try again.'))
        .finally(() => setSaving(false));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [saving, start, end]);

  function exportExcel() {
    const rows: Array<Array<string | number>> = [];
    for (const day of days) {
      day.pages.forEach((page, index) => {
        for (const line of page.lines) {
          rows.push([
            day.date,
            index + 1,
            line.qty,
            line.unit,
            line.description,
            line.unitPrice,
            line.amount,
          ]);
        }
        rows.push([day.date, index + 1, '', '', 'Total Sales', '', page.total]);
        if (page.discount)
          rows.push([day.date, index + 1, '', '', 'Less: SC/PWD Discount', '', page.discount]);
        rows.push([day.date, index + 1, '', '', 'TOTAL AMOUNT DUE', '', page.due]);
      });
    }
    downloadXlsx(`dagohoy-invoice-guide-${start}-to-${end}.xlsx`, [
      {
        name: 'Invoice guide',
        title: [
          `Invoice guide: ${start} to ${end} (from the sales recorded in the system)`,
          'Internal guide for writing the sales invoice booklet. Not an official BIR document.',
        ],
        header: ['Date', 'Page', 'Qty.', 'Unit', 'Articles/Description', 'Unit Price', 'Amount'],
        rows,
        widths: [12, 6, 6, 6, 40, 12, 12],
      },
    ]);
  }

  const busy = loading || Boolean(loadError) || !days.length;

  return (
    <>
      <p className="stock-index__warn">
        Guide for writing the sales invoice booklet, one day per invoice, from the sales recorded in
        this system. Copy the numbers as they are. It is not an official BIR document; ask your
        accountant how sales of ₱{OWN_INVOICE_FROM} or more should be invoiced.
      </p>
      <div className="duty-reports__filters">
        <label>
          From
          <input
            type="date"
            value={from}
            max={today}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            max={today}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </label>
        <label>
          Lines
          <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="items">One line per item</option>
            <option value="daily">One line per day</option>
          </select>
        </label>
        <button
          className="shift-report-modal__pdf"
          type="button"
          onClick={exportExcel}
          disabled={busy}
        >
          Export Excel
        </button>
        <button
          className="shift-report-modal__close"
          type="button"
          onClick={() => setSaving(true)}
          disabled={busy || saving}
        >
          {saving ? 'Saving PDF…' : 'Save as PDF'}
        </button>
      </div>
      {loading && <LoadingState label="Loading the sales…" />}
      {loadError && <ErrorState message={loadError} />}
      {!loading && !loadError && (
        <>
          <div className="stock-index__chips">
            <span>
              Days with sales <b>{days.length}</b>
            </span>
            <span>
              Booklet pages needed <b>{pageCount}</b>
            </span>
            <span>
              Total amount due <b>₱{money(totalDue)}</b>
            </span>
          </div>
          {!days.length && <p className="register-empty">No sales in these dates.</p>}
          <div className="invoice-guide">
            {days.map((day) => (
              <section className="invoice-guide__day" key={day.date}>
                {day.pages.map((page, index) => (
                  <InvoicePage day={day} page={page} index={index} key={index} />
                ))}
                {day.bigSales.length > 0 && (
                  <p className="invoice-guide__note">
                    Sales of ₱{OWN_INVOICE_FROM} or more this day:{' '}
                    {day.bigSales
                      .map(
                        (sale) =>
                          `${sale.receipt} (${new Date(sale.date).toLocaleTimeString('en-PH', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}, ₱${money(sale.total)})`,
                      )
                      .join(', ')}
                    . Ask your accountant if these need their own invoice.
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {saving &&
        createPortal(
          <div className="pdf-render-root" ref={pdfCopy} aria-hidden="true">
            <div className="invoice-guide is-print">
              {days.map((day) =>
                day.pages.map((page, index) => (
                  <InvoicePage day={day} page={page} index={index} key={`${day.date}-${index}`} />
                )),
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
