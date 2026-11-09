import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { getInventory } from '../../data/inventoryStore';
import { getSession, getShiftTotals } from '../../data/registerSession';

const SALES_KEY = 'dagohoy_demo_sales';

type DashTask = 'today' | 'mix' | 'movers' | 'stock';

type Sale = {
  receipt: string;
  date: string;
  items: number;
  total: number;
  payment: string;
  status: string;
  lines?: Array<{ product: string; quantity: number; unitPrice: number }>;
};

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);

function readSales(): Sale[] {
  try {
    return JSON.parse(localStorage.getItem(SALES_KEY) ?? '[]') as Sale[];
  } catch {
    return [];
  }
}

export function CashierDashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [tick, setTick] = useState(0);
  const [active, setActive] = useState<DashTask>('today');

  useEffect(() => {
    setSales(readSales());
  }, []);

  // Re-read the shift when it starts or ends from the top bar.
  useEffect(() => {
    const update = () => setTick((value) => value + 1);
    window.addEventListener('storage', update);
    window.addEventListener('dagohoy-store-status-change', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('dagohoy-store-status-change', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  const shift = useMemo(() => getSession(), [tick]);
  const totals = useMemo(() => getShiftTotals(), [tick]);
  const hoursOn = shift ? (Date.now() - new Date(shift.openedAt).getTime()) / 3_600_000 : 0;

  /* ---- Today's sales, for the hourly bars ---- */
  const todaySales = sales.filter(
    (sale) =>
      sale.status !== 'Voided' && new Date(sale.date).toDateString() === new Date().toDateString(),
  );
  const openHour = shift ? new Date(shift.openedAt).getHours() : 8;
  const closeHour = Math.max(openHour + 4, 20);

  const hourly = Array.from({ length: closeHour - openHour + 1 }, (_, index) => {
    const hour = openHour + index;
    const amount = todaySales
      .filter((sale) => new Date(sale.date).getHours() === hour)
      .reduce((sum, sale) => sum + sale.total, 0);
    return { hour, amount };
  });
  const peak = Math.max(1, ...hourly.map((slot) => slot.amount));

  /* ---- Payment mix ---- */
  const paymentTotals = todaySales.reduce<Record<string, number>>((acc, sale) => {
    acc[sale.payment] = (acc[sale.payment] ?? 0) + sale.total;
    return acc;
  }, {});
  const paymentEntries = Object.entries(paymentTotals).sort((a, b) => b[1] - a[1]);
  const paymentSum = paymentEntries.reduce((sum, [, value]) => sum + value, 0);
  const mixColors = ['#176246', '#4caa7a', '#96bf8a', '#d9d9b8'];

  /* ---- Best sellers ---- */
  const productTotals = todaySales
    .flatMap((sale) => sale.lines ?? [])
    .reduce<Record<string, { quantity: number; amount: number }>>((acc, line) => {
      const key = line.product;
      acc[key] = {
        quantity: (acc[key]?.quantity ?? 0) + line.quantity,
        amount: (acc[key]?.amount ?? 0) + line.quantity * line.unitPrice,
      };
      return acc;
    }, {});
  const bestSellers = Object.entries(productTotals)
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 4);
  const bestPeak = Math.max(1, ...bestSellers.map(([, value]) => value.quantity));

  /* ---- Stock health ---- */
  const inventory = useMemo(() => getInventory(), [tick]);
  const lowStock = inventory.filter((product) => product.status !== 'In Stock');
  const stockUses = Math.max(1, inventory.length);
  const stockTotal = inventory.reduce((sum, product) => sum + product.stock, 0);

  const itemCount = todaySales.reduce((sum, sale) => sum + sale.items, 0);
  const basket = todaySales.length ? itemCount / todaySales.length : 0;

  const tiles: Array<ControlItem<DashTask>> = [
    {
      key: 'today',
      icon: 'cash',
      title: "Today's sales",
      hint: `${todaySales.length} sale${todaySales.length === 1 ? '' : 's'} today`,
      tone: 'forest',
      count: todaySales.length,
      about: 'Cash in the drawer, sales so far, and sales hour by hour while your shift runs.',
    },
    {
      key: 'mix',
      icon: 'credit',
      title: 'Payment mix',
      hint: 'Cash, GCash, credit',
      tone: 'blue',
      count: paymentEntries.length,
      about: 'How customers paid today.',
    },
    {
      key: 'movers',
      icon: 'products',
      title: 'Fast movers',
      hint: 'Most sold today',
      tone: 'teal',
      count: bestSellers.length,
      about: 'The medicines sold the most today.',
    },
    {
      key: 'stock',
      icon: 'stock',
      title: 'Stock health',
      hint: lowStock.length ? 'Need restocking' : 'All in stock',
      tone: 'amber',
      count: lowStock.length,
      alert: lowStock.length > 0,
      about: 'Where the shelves stand right now, and which products are low or out.',
    },
  ];
  const activeTile = tiles.find((tile) => tile.key === active) ?? tiles[0];

  return (
    <div className="cashier-page dash-page">
      <ControlDeck
        id="dash"
        title="Dashboard"
        subtitle="Pick what to look at. It opens in the card below."
        items={tiles}
        active={active}
        onSelect={setActive}
        aside={
          <div className="dash-actions">
            <Link className="dash-action dash-action--primary" to="/cashier/pos">
              <CashierIcon name="pos" /> Open POS
            </Link>
            <Link className="dash-action" to="/cashier/transactions">
              <CashierIcon name="transactions" /> Transactions
            </Link>
            <Link className="dash-action" to="/cashier/register">
              <CashierIcon name="register" /> Cash drawer
            </Link>
          </div>
        }
      />

      <ControlPanel id="dash" activeKey={active} title={activeTile.title} about={activeTile.about}>
        {active === 'today' && (
          <>
            <section className="dash-kpis" aria-label="Shift at a glance">
              <article className="dash-kpi dash-kpi--hero">
                <div className="dash-kpi__head">
                  <span className="dash-kpi__icon">
                    <CashierIcon name="cash" />
                  </span>
                  <small>Cash in drawer (expected)</small>
                </div>
                <strong>{money(totals.expected)}</strong>
                <div className="dash-kpi__foot">
                  <span>Float {money(shift?.openingFloat ?? 0)}</span>
                  <span>Cash sales {money(totals.cashSales)}</span>
                </div>
              </article>

              <article className="dash-kpi">
                <div className="dash-kpi__head">
                  <span className="dash-kpi__icon">
                    <CashierIcon name="transactions" />
                  </span>
                  <small>Transactions</small>
                </div>
                <strong>{todaySales.length}</strong>
                <div className="dash-kpi__foot">
                  <span>{itemCount} items sold</span>
                  <span>{basket ? basket.toFixed(1) : '0'} items / basket</span>
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
                  {Math.floor(hoursOn)}h {Math.round((hoursOn % 1) * 60)}m
                </strong>
                <div className="dash-kpi__foot">
                  <span>
                    {shift ? shift.onDutyNames?.join(', ') || shift.cashierName : 'No shift yet'}
                  </span>
                </div>
              </article>

              <article className="dash-kpi">
                <div className="dash-kpi__head">
                  <span className="dash-kpi__icon">
                    <CashierIcon name="stock" />
                  </span>
                  <small>Needs restocking</small>
                </div>
                <strong>{lowStock.length}</strong>
                <div className="dash-kpi__foot">
                  <span>{stockHealthLine(lowStock.length, inventory.length)}</span>
                </div>
              </article>
            </section>

            <div className="dash-bars" role="img" aria-label="Hourly cash sales bar chart">
              {hourly.map((slot) => {
                const height = Math.max(4, (slot.amount / peak) * 100);
                return (
                  <div className="dash-bar" key={slot.hour}>
                    <div className="dash-bar__track">
                      <div
                        className={`dash-bar__fill${slot.amount ? '' : ' is-empty'}`}
                        style={{ height: `${height}%` }}
                      >
                        {slot.amount ? <span>₱{Math.round(slot.amount)}</span> : null}
                      </div>
                    </div>
                    <small>{formatHour(slot.hour)}</small>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {active === 'mix' &&
          (paymentEntries.length ? (
            <div>
              <div className="dash-donut">
                <div
                  className="dash-donut__ring"
                  style={{ background: donutGradient(paymentEntries, paymentSum, mixColors) }}
                />
                <div className="dash-donut__hole">
                  <strong>{money(paymentSum)}</strong>
                  <small>today</small>
                </div>
              </div>
              <ul className="dash-legend">
                {paymentEntries.map(([label, value], index) => (
                  <li key={label}>
                    <i style={{ background: mixColors[index % mixColors.length] }} />
                    <span>{label}</span>
                    <strong>{Math.round((value / paymentSum) * 100)}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="dash-empty">No sales yet today. Open the POS to start.</p>
          ))}

        {active === 'movers' &&
          (bestSellers.length ? (
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
          ))}

        {active === 'stock' && (
          <div className="dash-stock">
            <div className="dash-stock__bar" aria-hidden="true">
              <div
                className="dash-stock__healthy"
                style={{ width: `${((stockUses - lowStock.length) / stockUses) * 100}%` }}
              />
            </div>
            <div className="dash-stock__stats">
              <div>
                <strong>{stockTotal}</strong>
                <small>units in stock</small>
              </div>
              <div>
                <strong>{inventory.length - lowStock.length}</strong>
                <small>products healthy</small>
              </div>
              <div>
                <strong>{lowStock.length}</strong>
                <small>need restocking</small>
              </div>
            </div>
            {lowStock.length ? (
              <ul className="dash-alerts">
                {lowStock.map((product) => (
                  <li key={product.barcode}>
                    <span>{product.product}</span>
                    <em className={product.stock > 0 ? 'is-low' : 'is-out'}>
                      {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
                    </em>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </ControlPanel>
    </div>
  );
}
function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

function stockHealthLine(low: number, total: number) {
  if (!low) return `All ${total} products in stock`;
  return `${total - low} of ${total} products are healthy`;
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
