import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { shiftDuration, shiftVariance, type ShiftRecord } from '../../data/shiftHistory';
import { downloadPdf } from '../../lib/pdf';

/*
 * The duty report of one closed shift: a printable page with the cash count, the sales,
 * the items sold, the cash movements and every sales record. It is shown right after a shift
 * closes and from Duty reports, and Save as PDF downloads it as a file (no print dialog).
 */

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

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

/** Short, readable report number from the shift id and closing date. */
function reportNumber(shift: ShiftRecord) {
  const day = new Date(shift.closedAt).toLocaleDateString('en-CA').replaceAll('-', '');
  return `SR-${day}-${shift.id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export function ShiftReportDocument({ shift }: { shift: ShiftRecord }) {
  const store = readStore();
  const { variance, label } = shiftVariance(shift);
  const names = shift.onDutyNames?.length ? shift.onDutyNames : [shift.cashierName];
  const details = shift.details;

  return (
    <article className="shift-doc">
      <header className="shift-doc__head">
        <div>
          <strong>{store.name}</strong>
          {store.address && <span>{store.address}</span>}
          {store.phone && <span>Tel: {store.phone}</span>}
        </div>
        <div className="shift-doc__title">
          <h2>Shift duty report</h2>
          <span>{reportNumber(shift)}</span>
        </div>
      </header>

      <dl className="shift-doc__facts">
        <div>
          <dt>Cashier</dt>
          <dd>
            {names[0]}
            {names.length > 1 && (
              <span className="shift-doc__with">With: {names.slice(1).join(', ')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Shift</dt>
          <dd>
            {dateTime(shift.openedAt)} to {timeOnly(shift.closedAt)}
          </dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{shiftDuration(shift.openedAt, shift.closedAt)}</dd>
        </div>
        <div>
          <dt>Drawer</dt>
          <dd>
            <span className={`shift-doc__badge is-${label.toLowerCase()}`}>
              {label}
              {label !== 'Balanced' && ` ${money(Math.abs(variance))}`}
            </span>
          </dd>
        </div>
      </dl>

      <section className="shift-doc__section">
        <h3>1. Cash drawer</h3>
        <table className="shift-doc__sum">
          <tbody>
            <tr>
              <td>Opening float</td>
              <td>{money(shift.openingFloat)}</td>
            </tr>
            {shift.floatAdjustment && (
              <tr className="is-note">
                <td colSpan={2}>
                  Float changed from {money(shift.floatAdjustment.carriedOver)}:{' '}
                  {shift.floatAdjustment.reason}
                </td>
              </tr>
            )}
            <tr>
              <td>Cash sales</td>
              <td>+ {money(shift.cashSales)}</td>
            </tr>
            {shift.creditCash !== undefined && (
              <tr>
                <td>Utang cash (down payments and paid balances)</td>
                <td>+ {money(shift.creditCash)}</td>
              </tr>
            )}
            <tr>
              <td>Cash in</td>
              <td>+ {money(shift.paidIn)}</td>
            </tr>
            <tr>
              <td>Cash out</td>
              <td>− {money(shift.paidOut)}</td>
            </tr>
            <tr className="is-total">
              <td>Expected in drawer</td>
              <td>{money(shift.expectedCash)}</td>
            </tr>
            <tr>
              <td>Counted at closing</td>
              <td>{money(shift.countedCash)}</td>
            </tr>
            <tr className={`is-total is-${label.toLowerCase()}`}>
              <td>Difference</td>
              <td>
                {variance > 0 ? '+ ' : variance < 0 ? '− ' : ''}
                {money(Math.abs(variance))}
              </td>
            </tr>
            {shift.varianceNote && (
              <tr className="is-note">
                <td colSpan={2}>Cashier's note: {shift.varianceNote}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {!details ? (
        <p className="shift-doc__missing">
          Sales, items and cash movements were not saved for shifts closed before duty reports were
          added. Only the cash count above is available.
        </p>
      ) : (
        <>
          <section className="shift-doc__section">
            <h3>2. Sales</h3>
            <div className="shift-doc__stats">
              <div>
                <span>Sales</span>
                <strong>{shift.salesCount}</strong>
              </div>
              <div>
                <span>Total sales</span>
                <strong>{money(details.grossSales)}</strong>
              </div>
              <div>
                <span>Discounts given</span>
                <strong>{money(details.discounts)}</strong>
              </div>
              <div>
                <span>New utang</span>
                <strong>{money(details.newUtang)}</strong>
              </div>
            </div>
            <table className="shift-doc__table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Sales</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(details.paymentTotals).length === 0 && (
                  <tr>
                    <td colSpan={3}>No sales during this shift.</td>
                  </tr>
                )}
                {Object.entries(details.paymentTotals).map(([method, amount]) => (
                  <tr key={method}>
                    <td>{method}</td>
                    <td>{shift.salesByPayment[method] ?? 0}</td>
                    <td>{money(amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="shift-doc__flags">
              <li className={details.pendingGcash ? 'is-warn' : undefined}>
                GCash still pending: <b>{details.pendingGcash}</b>
              </li>
              <li className={details.voidedCount ? 'is-warn' : undefined}>
                Voided sales: <b>{details.voidedCount}</b> ({money(details.voidedTotal)})
              </li>
              <li>
                No-charge records: <b>{details.noChargeCount}</b> ({money(details.noChargeValue)}{' '}
                worth)
              </li>
            </ul>
          </section>

          <section className="shift-doc__section">
            <h3>3. Items sold</h3>
            <table className="shift-doc__table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {details.items.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No items sold.</td>
                  </tr>
                ) : (
                  details.items.map((item) => (
                    <tr key={item.product}>
                      <td>{item.product}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="shift-doc__section">
            <h3>4. Cash in and out</h3>
            <table className="shift-doc__table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {details.cashEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No cash taken out or put in.</td>
                  </tr>
                ) : (
                  details.cashEvents.map((event) => (
                    <tr key={`${event.date}-${event.reason}`}>
                      <td>{timeOnly(event.date)}</td>
                      <td>{event.type}</td>
                      <td>{event.reason}</td>
                      <td>
                        {event.type === 'Paid out' ? '− ' : '+ '}
                        {money(event.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="shift-doc__section">
            <h3>5. Sales records</h3>
            <table className="shift-doc__table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Time</th>
                  <th>Payment</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {details.sales.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No sales.</td>
                  </tr>
                ) : (
                  details.sales.map((sale) => (
                    <tr key={sale.receipt} className={sale.status === 'Voided' ? 'is-void' : ''}>
                      <td>{sale.receipt}</td>
                      <td>{timeOnly(sale.date)}</td>
                      <td>{sale.payment}</td>
                      <td>{sale.items}</td>
                      <td>{money(sale.total)}</td>
                      <td>{sale.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      <footer className="shift-doc__sign">
        <div>
          <span />
          Cashier: {names[0]}
        </div>
        <div>
          <span />
          Checked by (owner / admin)
        </div>
      </footer>
      <p className="shift-doc__printed">
        Printed {dateTime(new Date().toISOString())} · {store.name}
      </p>
    </article>
  );
}

/**
 * Popup with the duty report and a Save as PDF button. Saving draws a copy of the report off
 * screen at A4 width and downloads it as a PDF file.
 */
export function ShiftReportModal({
  shift,
  heading = 'Shift duty report',
  onClose,
}: {
  shift: ShiftRecord;
  heading?: string;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const pdfCopy = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!saving) return;
    const name = `Shift report ${shift.cashierName} ${new Date(shift.closedAt).toLocaleDateString('en-CA')}`;
    // Wait one frame so the off-screen copy is drawn before it is captured.
    const timer = window.setTimeout(() => {
      if (!pdfCopy.current) return setSaving(false);
      downloadPdf(pdfCopy.current, name)
        .catch(() => window.alert('The PDF could not be made. Please try again.'))
        .finally(() => setSaving(false));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [saving, shift]);

  const host = document.querySelector<HTMLElement>('.cashier-shell') ?? document.body;

  return (
    <>
      {createPortal(
        <div className="pos-modal-backdrop">
          <div className="pos-payment-modal shift-report-modal">
            <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
              ×
            </button>
            <div className="shift-report-modal__bar">
              <div>
                <p className="eyebrow">Duty report</p>
                <h2>{heading}</h2>
              </div>
              <div className="shift-report-modal__actions">
                <button
                  className="shift-report-modal__pdf"
                  type="button"
                  onClick={() => setSaving(true)}
                  disabled={saving}
                >
                  {saving ? 'Saving PDF…' : 'Save as PDF'}
                </button>
                <button className="shift-report-modal__close" type="button" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
            <p className="shift-report-modal__hint">
              Save as PDF downloads the report as a file to your Downloads folder.
            </p>
            <div className="shift-report-modal__paper">
              <ShiftReportDocument shift={shift} />
            </div>
          </div>
        </div>,
        host,
      )}
      {saving &&
        createPortal(
          <div className="pdf-render-root" ref={pdfCopy} aria-hidden="true">
            <ShiftReportDocument shift={shift} />
          </div>,
          document.body,
        )}
    </>
  );
}
