import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { HourlyBars } from '../../components/HourlyBars';
import { formatHour, hourRange } from '../../components/hours';
import { getInventory } from '../../data/inventoryStore';
import { getSession, getShiftTotals } from '../../data/registerSession';

const SALES_KEY = 'dagohoy_demo_sales';

type Sale = {
  receipt: string;
  date: string;
  items: number;
  total: number;
  payment: string;
  status: string;
  customer?: string;
  lines?: Array<{ product: string; quantity: number; unitPrice: number }>;
};

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

/** Sales that count: not voided and not a no-charge slip. */
function readSales(): Sale[] {
  try {
    return (JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[]).filter(
      (sale) => sale.status !== 'Voided' && sale.payment !== 'No charge',
    );
  } catch {
    return [];
  }
}

const sameDay = (date: Date, other: Date) => date.toDateString() === other.toDateString();

/** Cashier dashboard: a read-only quick view of today. No control buttons. */
export function CashierDashboardPage() {
  const [tick, setTick] = useState(0);

  // Re-read when a sale, shift or another tab changes the data, and every minute.
  useEffect(() => {
    const update = () => setTick((value) => value + 1);
    window.addEventListener('storage', update);
    window.addEventListener('dagohoy-store-status-change', update);
    window.addEventListener('focus', update);
    const timer = window.setInterval(update, 60_000);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('dagohoy-store-status-change', update);
      window.removeEventListener('focus', update);
      window.clearInterval(timer);
    };
  }, []);

  const sales = useMemo(() => readSales(), [tick]);
  const shift = useMemo(() => getSession(), [tick]);
  const totals = useMemo(() => getShiftTotals(), [tick]);
  const inventory = useMemo(() => getInventory(), [tick]);
  const now = new Date();
  const hoursOn = shift ? (now.getTime() - new Date(shift.openedAt).getTime()) / 3_600_000 : 0;

  const todaySales = sales.filter((sale) => sameDay(new Date(sale.date), now));
  const salesToday = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const itemCount = todaySales.reduce((sum, sale) => sum + Number(sale.items ?? 0), 0);

  // Yesterday up to this same time of day, for a fair comparison.
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySoFar = sales
    .filter((sale) => {
      const date = new Date(sale.date);
      return sameDay(date, yesterday) && date <= yesterday;
    })
    .reduce((sum, sale) => sum + sale.total, 0);
  const versus = yesterdaySoFar
    ? `${salesToday >= yesterdaySoFar ? '▲' : '▼'} ${Math.abs(
        Math.round(((salesToday - yesterdaySoFar) / yesterdaySoFar) * 100),
      )}% vs this time yesterday`
    : 'No sales by this time yesterday';

  /* ---- Sales by hour, with the usual amount (average of the last 7 days) ---- */
  const weekAgo = new Date(now.toDateString());
  weekAgo.setDate(weekAgo.getDate() - 7);
  const lastWeek = sales.filter((sale) => {
    const date = new Date(sale.date);
    return date >= weekAgo && !sameDay(date, now);
  });
  const hours = hourRange(
    [...todaySales, ...lastWeek]
      .map((sale) => new Date(sale.date))
      .concat(shift ? [new Date(shift.openedAt)] : []),
  );
  const amountAt = (list: Sale[], hour: number) =>
    list
      .filter((sale) => new Date(sale.date).getHours() === hour)
      .reduce((sum, sale) => sum + sale.total, 0);
  const slots = hours.map((hour) => ({
    hour,
    amount: amountAt(todaySales, hour),
    average: lastWeek.length ? amountAt(lastWeek, hour) / 7 : undefined,
  }));
  const peak = slots.reduce((best, slot) => (slot.amount > best.amount ? slot : best), slots[0]);
  const usualPeak = slots.reduce(
    (best, slot) => ((slot.average ?? 0) > (best.average ?? 0) ? slot : best),
    slots[0],
  );

  /* ---- Payment mix ---- */
  const paymentEntries = Object.entries(
    todaySales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.payment] = (acc[sale.payment] ?? 0) + sale.total;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const mixColors = ['#176246', '#4caa7a', '#c98a2c', '#96bf8a'];

  /* ---- Best sellers ---- */
  const bestSellers = Object.entries(
    todaySales
      .flatMap((sale) => sale.lines ?? [])
      .reduce<Record<string, { quantity: number; amount: number }>>((acc, line) => {
        acc[line.product] = {
          quantity: (acc[line.product]?.quantity ?? 0) + line.quantity,
          amount: (acc[line.product]?.amount ?? 0) + line.quantity * line.unitPrice,
        };
        return acc;
      }, {}),
  )
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5);
  const bestPeak = Math.max(1, ...bestSellers.map(([, value]) => value.quantity));

  const lowStock = inventory
    .filter((product) => product.status !== 'In Stock')
    .sort((a, b) => a.stock - b.stock);
  const recent = todaySales.slice(0, 5);

  return (
    <div className="cashier-page dash-page">
      <header className="dash-head">
        <div>
          <p className="dash-head__date">
            {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className={`dash-head__shift${shift ? ' is-open' : ''}`}>
            <i aria-hidden="true" />
            {shift
              ? `Shift open since ${time(shift.openedAt)} · ${
                  shift.onDutyNames?.join(', ') || shift.cashierName
                }`
              : 'No shift open. Press Start shift at the top to begin.'}
          </p>
        </div>
        <div className="dash-actions">
          <Link className="dash-action dash-action--primary" to="/cashier/pos">
            <CashierIcon name="pos" /> Open POS
          </Link>
          <Link className="dash-action" to="/cashier/transactions">
            <CashierIcon name="transactions" /> Transactions
          </Link>
        </div>
      </header>

      <section className="dash-kpis" aria-label="Today at a glance">
        <article className="dash-kpi dash-kpi--hero">
          <div className="dash-kpi__head">
            <span className="dash-kpi__icon">
              <CashierIcon name="reports" />
            </span>
            <small>Sales today</small>
          </div>
          <strong>{money(salesToday)}</strong>
          <div className="dash-kpi__foot">
            <span>{versus}</span>
          </div>
        </article>

        <article className="dash-kpi">
          <div className="dash-kpi__head">
            <span className="dash-kpi__icon">
              <CashierIcon name="cash" />
            </span>
            <small>Cash in drawer (expected)</small>
          </div>
          <strong>{money(totals.expected)}</strong>
          <div className="dash-kpi__foot">
            <span>Start {money(shift?.openingFloat ?? 0)}</span>
            <span>Cash sales {money(totals.cashSales)}</span>
          </div>
        </article>

        <article className="dash-kpi">
          <div className="dash-kpi__head">
            <span className="dash-kpi__icon">
              <CashierIcon name="transactions" />
            </span>
            <small>Customers served</small>
          </div>
          <strong>{todaySales.length}</strong>
          <div className="dash-kpi__foot">
            <span>{itemCount} items sold</span>
            <span>
              Avg {money(todaySales.length ? salesToday / todaySales.length : 0)} per sale
            </span>
          </div>
        </article>

        <article className="dash-kpi">
          <div className="dash-kpi__head">
            <span className="dash-kpi__icon">
              <CashierIcon name="clock" />
            </span>
            <small>Time on shift</small>
          </div>
          <strong>
            {Math.floor(hoursOn)}h {Math.floor((hoursOn % 1) * 60)}m
          </strong>
          <div className="dash-kpi__foot">
            <span>{shift ? `Cashier: ${shift.cashierName}` : 'No shift yet'}</span>
          </div>
        </article>
      </section>

      <section className="dash-card dash-card--wide">
        <header className="dash-card__head">
          <div>
            <h3>Sales by hour</h3>
            <p>Today's sales for each hour. The dashed line is a usual day (last 7 days).</p>
          </div>
          <div className="dash-chips">
            <span className="dash-chip is-strong">
              Busiest today:{' '}
              {peak && peak.amount ? `${formatHour(peak.hour)} · ${money(peak.amount)}` : '—'}
            </span>
            {usualPeak?.average ? (
              <span className="dash-chip">Usually busiest: {formatHour(usualPeak.hour)}</span>
            ) : null}
          </div>
        </header>
        <HourlyBars slots={slots} nowHour={now.getHours()} label="Sales for each hour today" />
      </section>

      <div className="dash-grid">
        <section className="dash-card">
          <header className="dash-card__head">
            <h3>How customers paid</h3>
          </header>
          {paymentEntries.length ? (
            <div className="dash-mix">
              <div className="dash-donut">
                <div
                  className="dash-donut__ring"
                  style={{ background: donutGradient(paymentEntries, salesToday, mixColors) }}
                />
                <div className="dash-donut__hole">
                  <strong>{money(salesToday)}</strong>
                  <small>today</small>
                </div>
              </div>
              <ul className="dash-legend">
                {paymentEntries.map(([label, value], index) => (
                  <li key={label}>
                    <i style={{ background: mixColors[index % mixColors.length] }} />
                    <span>{label}</span>
                    <strong>{money(value)}</strong>
                    <em>{Math.round((value / salesToday) * 100)}%</em>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="dash-empty">No sales yet today.</p>
          )}
        </section>

        <section className="dash-card">
          <header className="dash-card__head">
            <h3>Fast movers today</h3>
          </header>
          {bestSellers.length ? (
            <ul className="dash-rank">
              {bestSellers.map(([name, value]) => (
                <li key={name}>
                  <div className="dash-rank__top">
                    <span>{name}</span>
                    <strong>{value.quantity} pcs</strong>
                  </div>
                  <div className="dash-rank__track">
                    <div
                      className="dash-rank__fill"
                      style={{ width: `${(value.quantity / bestPeak) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">Nothing sold yet today.</p>
          )}
        </section>

        <section className="dash-card">
          <header className="dash-card__head">
            <h3>Latest sales</h3>
            <Link to="/cashier/transactions">See all</Link>
          </header>
          {recent.length ? (
            <ul className="dash-recent">
              {recent.map((sale) => (
                <li key={sale.receipt}>
                  <span className="dash-recent__time">{time(sale.date)}</span>
                  <span className="dash-recent__who">
                    <strong>{sale.receipt}</strong>
                    <small>
                      {sale.payment}
                      {sale.customer ? ` · ${sale.customer}` : ''}
                      {sale.status === 'Pending GCash' ? ' · not yet confirmed' : ''}
                    </small>
                  </span>
                  <strong>{money(sale.total)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">No sales yet today.</p>
          )}
        </section>

        <section className="dash-card">
          <header className="dash-card__head">
            <h3>Running low</h3>
            {lowStock.length > 0 && <span className="dash-chip is-warn">{lowStock.length}</span>}
          </header>
          {lowStock.length ? (
            <ul className="dash-alerts">
              {lowStock.slice(0, 6).map((product) => (
                <li key={product.barcode}>
                  <span>{product.product}</span>
                  <em className={product.stock > 0 ? 'is-low' : 'is-out'}>
                    {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
                  </em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">
              All {inventory.length} products are in stock. Nothing to restock.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function donutGradient(entries: Array<[string, number]>, sum: number, colors: string[]) {
  let start = 0;
  const stops = entries.map(([, value], index) => {
    const end = start + (value / sum) * 100;
    const stop = `${colors[index % colors.length]} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}
