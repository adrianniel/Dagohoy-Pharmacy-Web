import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { getCurrentAccount } from '../../data/accountStore';
import { getPreviousShift } from '../../data/shiftHistory';

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

type ShiftView = 'summary' | 'staff' | 'handover';

/** Handover summary of the last closed shift. Daily and weekly income stay in Reports. */
export function ShiftReportPage() {
  const shift = getPreviousShift();
  const isAdmin = getCurrentAccount()?.role === 'ADMIN';
  const [view, setView] = useState<ShiftView>('summary');

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
        title="Shift report"
        subtitle="The last closed shift. Pick what to check."
        items={items}
        active={view}
        onSelect={setView}
      />
      <ControlPanel
        id="shift-report"
        activeKey={view}
        title={activeItem?.title ?? 'Shift report'}
        about={activeItem?.about}
      >
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
              {onDuty.length > 1 && ' The first name is the one printed on receipts.'}
            </p>
            <ol className="shift-report__duty-list">
              {onDuty.map((name, index) => (
                <li key={`${name}-${index}`}>
                  <span className="shift-report__duty-index">{index + 1}</span>
                  <strong>{name}</strong>
                  {index === 0 && onDuty.length > 1 && (
                    <span className="shift-report__duty-tag">Named on receipts</span>
                  )}
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
      <p className="shift-report__note">
        {isAdmin ? (
          <>
            Cashiers see only this last-shift summary. Full sales and income are in{' '}
            <Link to="/admin/reports">Reports</Link>.
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
