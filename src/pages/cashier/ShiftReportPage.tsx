import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { getCurrentAccount } from '../../data/accountStore';
import { downloadXlsx } from '../../lib/xlsx';
import { ShiftReportModal } from '../../components/cashier/ShiftReport';
import {
  getPreviousShift,
  loadShiftHistory,
  shiftDuration,
  shiftVariance,
  type ShiftRecord,
} from '../../data/shiftHistory';

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function duration(from: string, to: string) {
  const minutes = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} hr ${rest} min` : `${rest} min`;
}

type ShiftView = 'reports' | 'summary' | 'staff' | 'handover';
type Period = '7' | '30' | 'all';

/** Handover summary of the last closed shift. Daily and weekly income stay in Reports. */
export function ShiftReportPage() {
  const shift = getPreviousShift();
  const isAdmin = getCurrentAccount()?.role === 'ADMIN';
  // Owners and admins start on the list of every shift; cashiers see the last one.
  const [view, setView] = useState<ShiftView>(isAdmin ? 'reports' : 'summary');
  const [preview, setPreview] = useState<ShiftRecord | null>(null);

  if (!shift) {
    return (
      <div className="cashier-page">
        <section className="cashier-panel">
          <div className="expenses-empty-state">
            <strong>No closed shift yet</strong>
            <span>The handover summary appears here after a cashier closes the register.</span>
            <Link className="cashier-primary-action" to="/cashier/register">
              Go to cash drawer
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const variance = shift.countedCash - shift.expectedCash;
  const varianceLabel = Math.abs(variance) < 0.005 ? 'Balanced' : variance > 0 ? 'Over' : 'Short';
  const payments = Object.entries(shift.salesByPayment);
  const onDuty = shift.onDutyNames?.length ? shift.onDutyNames : [shift.cashierName];

  const items: Array<ControlItem<ShiftView>> = [
    ...(isAdmin
      ? [
          {
            key: 'reports' as const,
            icon: 'transactions' as const,
            title: 'Duty reports',
            hint: 'Every closed shift',
            tone: 'teal' as const,
            count: loadShiftHistory().length,
            about:
              'Every closed shift, newest first. Open one to see the full report or save it as a PDF.',
          },
        ]
      : []),
    {
      key: 'summary',
      icon: 'reports',
      title: 'Summary',
      hint: `${varianceLabel} drawer`,
      tone: 'forest',
      count: shift.salesCount,
      alert: varianceLabel !== 'Balanced',
      about: 'Who closed the last shift, how long it ran, and whether the drawer matched.',
    },
    {
      key: 'staff',
      icon: 'staff',
      title: 'Staff on duty',
      hint: 'Who served',
      tone: 'blue',
      count: onDuty.length,
      about: 'Everyone who worked the last shift, in the order they were picked.',
    },
    {
      key: 'handover',
      icon: 'register',
      title: 'Drawer handover',
      hint: 'Cash to check',
      tone: 'amber',
      about: 'Check the drawer against these figures before you open your shift.',
    },
  ];
  const activeItem = items.find((item) => item.key === view);

  return (
    <div className="cashier-page shift-report">
      <ControlDeck
        id="shift-report"
        title={isAdmin ? 'Shift and duty reports' : 'Shift report'}
        subtitle={
          isAdmin
            ? 'Check any cashier shift. Pick what to look at.'
            : 'The last closed shift. Pick what to check.'
        }
        items={items}
        active={view}
        onSelect={setView}
      />
      <ControlPanel
        id="shift-report"
        activeKey={view}
        title={activeItem?.title ?? 'Shift report'}
        about={activeItem?.about}
        actions={
          view !== 'reports' && (
            <button
              className="shift-report-modal__pdf"
              type="button"
              onClick={() => setPreview(shift)}
            >
              Preview &amp; PDF
            </button>
          )
        }
      >
        {view === 'reports' && <DutyReports onOpen={setPreview} />}

        {view === 'summary' && (
          <>
            <section className="cashier-panel shift-report__header">
              <div>
                <p className="shift-report__label">Previous shift</p>
                <h3>{shift.cashierName}</h3>
                <span>
                  {dateTime(shift.openedAt)} to {dateTime(shift.closedAt)} ·{' '}
                  {duration(shift.openedAt, shift.closedAt)}
                </span>
              </div>
              <span className={`shift-variance shift-variance--${varianceLabel.toLowerCase()}`}>
                {varianceLabel}
                {varianceLabel !== 'Balanced' && ` ${money(Math.abs(variance))}`}
              </span>
            </section>

            <div className="cashier-summary-grid">
              <ShiftStat
                label="Sales recorded"
                value={String(shift.salesCount)}
                detail={paymentSummary(payments)}
              />
              <ShiftStat
                label="Opening float"
                value={money(shift.openingFloat)}
                detail="Cash at the start"
              />
              <ShiftStat
                label="Expected cash"
                value={money(shift.expectedCash)}
                detail="Float + cash sales + paid in − paid out"
              />
              <ShiftStat
                label="Counted cash"
                value={money(shift.countedCash)}
                detail="Counted at closing"
              />
            </div>
          </>
        )}

        {view === 'staff' && (
          <section className="cashier-panel shift-report__duty">
            <p className="inventory-form-note">
              {onDuty.length} {onDuty.length === 1 ? 'person served' : 'people served'} this shift.
              {onDuty.length > 1 && ' The cashier in charge is the name printed on receipts.'}
            </p>
            <ol className="shift-report__duty-list">
              {onDuty.map((name, index) => (
                <li key={`${name}-${index}`}>
                  <span className="shift-report__duty-index">{index + 1}</span>
                  <strong>{name}</strong>
                  {index === 0 && <span className="shift-report__duty-tag">Cashier in charge</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {view === 'handover' && (
          <section className="cashier-panel">
            <dl className="shift-report__lines">
              <div>
                <dt>Opening float</dt>
                <dd>{money(shift.openingFloat)}</dd>
              </div>
              <div>
                <dt>Cash sales</dt>
                <dd>+ {money(shift.cashSales)}</dd>
              </div>
              {shift.creditCash !== undefined && (
                <div>
                  <dt>Utang cash</dt>
                  <dd>+ {money(shift.creditCash)}</dd>
                </div>
              )}
              <div>
                <dt>Paid in</dt>
                <dd>+ {money(shift.paidIn)}</dd>
              </div>
              <div>
                <dt>Paid out</dt>
                <dd>− {money(shift.paidOut)}</dd>
              </div>
              <div className="shift-report__total">
                <dt>Expected in drawer</dt>
                <dd>{money(shift.expectedCash)}</dd>
              </div>
              <div>
                <dt>Counted at closing</dt>
                <dd>{money(shift.countedCash)}</dd>
              </div>
              <div className="shift-report__total">
                <dt>Difference</dt>
                <dd>
                  {variance > 0 ? '+ ' : variance < 0 ? '− ' : ''}
                  {money(Math.abs(variance))}
                </dd>
              </div>
              {shift.varianceNote && (
                <div>
                  <dt>Cashier's note</dt>
                  <dd>{shift.varianceNote}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </ControlPanel>
      {preview && <ShiftReportModal shift={preview} onClose={() => setPreview(null)} />}
      <p className="shift-report__note">
        {isAdmin ? (
          <>
            Cashiers see only the last shift. Owners and admins see every duty report here; weekly
            income is in <Link to="/admin/reports">Reports</Link>.
          </>
        ) : (
          'Only the last closed shift is shown here. Sales and income reports are kept by the owner.'
        )}
      </p>
    </div>
  );
}

function paymentSummary(payments: [string, number][]) {
  if (!payments.length) return 'No sales during the shift';
  return payments.map(([method, count]) => `${method} ${count}`).join(', ');
}

function ShiftStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="cashier-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

/** Owner view: every closed shift with filters, and a button to open each duty report. */
function DutyReports({ onOpen }: { onOpen: (shift: ShiftRecord) => void }) {
  const history = useMemo(loadShiftHistory, []);
  const [cashier, setCashier] = useState('all');
  const [period, setPeriod] = useState<Period>('30');

  const names = useMemo(
    () => [...new Set(history.flatMap((shift) => shift.onDutyNames ?? [shift.cashierName]))].sort(),
    [history],
  );
  const since = period === 'all' ? 0 : Date.now() - Number(period) * 86400000;
  const rows = history.filter(
    (shift) =>
      Date.parse(shift.closedAt) >= since &&
      (cashier === 'all' || (shift.onDutyNames ?? [shift.cashierName]).includes(cashier)),
  );
  const notBalanced = rows.filter((shift) => shiftVariance(shift).label !== 'Balanced');
  const netDifference = rows.reduce((sum, shift) => sum + shiftVariance(shift).variance, 0);

  function exportExcel() {
    let pharmacy = 'Dagohoy Pharmacy';
    try {
      const settings = JSON.parse(
        localStorage.getItem('dagohoy_demo_pharmacy_settings') ?? '{}',
      ) as { name?: string };
      pharmacy = settings.name?.trim() || pharmacy;
    } catch {
      // keep the default name
    }
    const periodLabel = period === 'all' ? 'All saved shifts' : `Last ${period} days`;
    const round = (value: number) => Math.round(value * 100) / 100;
    downloadXlsx(`dagohoy-duty-reports-${new Date().toLocaleDateString('en-CA')}.xlsx`, [
      {
        name: 'Duty reports',
        title: [
          pharmacy,
          `Duty reports: ${cashier === 'all' ? 'Everyone' : cashier} · ${periodLabel}`,
          `Generated ${new Date().toLocaleString('en-PH')}`,
        ],
        header: [
          'Closed date',
          'Closed time',
          'On duty',
          'Length (minutes)',
          'Length',
          'Sales',
          'Total sales',
          'Opening float',
          'Cash sales',
          'Utang cash',
          'Cash in',
          'Cash out',
          'Expected',
          'Counted',
          'Difference',
          'Drawer',
          'Note',
        ],
        rows: rows.map((shift) => {
          const closed = new Date(shift.closedAt);
          const { variance, label } = shiftVariance(shift);
          return [
            closed.toLocaleDateString('en-CA'),
            closed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
            (shift.onDutyNames ?? [shift.cashierName]).join(', '),
            Math.max(
              0,
              Math.round((Date.parse(shift.closedAt) - Date.parse(shift.openedAt)) / 60000),
            ),
            shiftDuration(shift.openedAt, shift.closedAt),
            shift.salesCount,
            shift.details ? round(shift.details.grossSales) : null,
            round(shift.openingFloat),
            round(shift.cashSales),
            shift.creditCash !== undefined ? round(shift.creditCash) : null,
            round(shift.paidIn),
            round(shift.paidOut),
            round(shift.expectedCash),
            round(shift.countedCash),
            variance,
            label,
            shift.varianceNote ?? '',
          ];
        }),
        widths: [12, 11, 22, 10, 14, 7, 12, 12, 12, 11, 10, 10, 12, 12, 11, 10, 30],
      },
    ]);
  }

  if (!history.length) {
    return <p className="register-empty">No shift has been closed yet.</p>;
  }

  return (
    <>
      <div className="duty-reports__filters">
        <label>
          Cashier
          <select value={cashier} onChange={(event) => setCashier(event.target.value)}>
            <option value="all">Everyone</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All saved shifts</option>
          </select>
        </label>
        <button
          className="shift-report-modal__pdf"
          type="button"
          onClick={exportExcel}
          disabled={!rows.length}
        >
          Export Excel
        </button>
      </div>
      <div className="stock-index__chips">
        <span>
          Shifts <b>{rows.length}</b>
        </span>
        <span className={notBalanced.length ? 'is-low' : undefined}>
          Short or over <b>{notBalanced.length}</b>
        </span>
        <span>
          Net difference{' '}
          <b>
            {netDifference > 0 ? '+' : netDifference < 0 ? '−' : ''}
            {money(Math.abs(netDifference))}
          </b>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="register-empty">No shifts match these filters.</p>
      ) : (
        <div className="cashier-table-wrap" role="region" aria-label="Duty reports" tabIndex={0}>
          <table className="cashier-table">
            <thead>
              <tr>
                <th>Closed</th>
                <th>On duty</th>
                <th>Length</th>
                <th>Sales</th>
                <th>Expected</th>
                <th>Counted</th>
                <th>Drawer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((shift) => {
                const { variance, label } = shiftVariance(shift);
                return (
                  <tr key={shift.id}>
                    <td>{dateTime(shift.closedAt)}</td>
                    <td>
                      <strong>{(shift.onDutyNames ?? [shift.cashierName]).join(', ')}</strong>
                      {shift.varianceNote && (
                        <small className="duty-reports__note">Note: {shift.varianceNote}</small>
                      )}
                    </td>
                    <td>{shiftDuration(shift.openedAt, shift.closedAt)}</td>
                    <td>
                      {shift.salesCount}
                      {shift.details && (
                        <small className="duty-reports__note">
                          {money(shift.details.grossSales)}
                        </small>
                      )}
                    </td>
                    <td>{money(shift.expectedCash)}</td>
                    <td>{money(shift.countedCash)}</td>
                    <td>
                      <span className={`shift-doc__badge is-${label.toLowerCase()}`}>
                        {label}
                        {label !== 'Balanced' &&
                          ` ${variance > 0 ? '+' : '−'}${money(Math.abs(variance))}`}
                      </span>
                    </td>
                    <td>
                      <button
                        className="cashier-view-button"
                        type="button"
                        onClick={() => onOpen(shift)}
                      >
                        View report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
