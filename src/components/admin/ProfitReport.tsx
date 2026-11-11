import { useEffect, useState } from 'react';
import { getProfit, type ApiProfitMonth } from '../../services/storeApi';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';

/*
 * Profit report for the owner: did the pharmacy earn this month, and month by month?
 * Profit = sales − what the sold items cost − expenses − items given free − stock lost.
 * "Cash to owner" is money the owner took home, so it is shown apart, never as a cost.
 */

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const monthName = (month: string, style: 'long' | 'short' = 'long') =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', {
    month: style,
    ...(style === 'long' ? { year: 'numeric' } : {}),
  });
const costsOf = (month: ApiProfitMonth) =>
  month.costOfGoods + month.expenses + month.freeItems + month.stockLosses;

/** Where each peso of sales went, as one bar: cost of goods, expenses, other, and what is left. */
function WhereMoneyWent({ month }: { month: ApiProfitMonth }) {
  const parts = [
    { key: 'cogs', label: 'Cost of the items sold', value: month.costOfGoods },
    { key: 'expenses', label: 'Expenses', value: month.expenses },
    {
      key: 'other',
      label: 'Free items and stock lost',
      value: month.freeItems + month.stockLosses,
    },
    { key: 'profit', label: 'Profit (yours to keep)', value: Math.max(0, month.profit) },
  ].filter((part) => part.value > 0);
  // When costs are more than sales, the bar is the costs and the sales line shows the gap.
  const whole = Math.max(month.sales, costsOf(month)) || 1;
  return (
    <div className="profit-split">
      <div className="profit-split__bar" role="img" aria-label="Where the sales money went">
        {parts.map((part) => (
          <span
            key={part.key}
            className={`profit-split__part is-${part.key}`}
            style={{ width: `${(part.value / whole) * 100}%` }}
            title={`${part.label}: ${money(part.value)}`}
          />
        ))}
      </div>
      {month.profit < 0 && month.sales > 0 && (
        <div className="profit-split__sales" style={{ width: `${(month.sales / whole) * 100}%` }}>
          <span>Sales {money(month.sales)}</span>
        </div>
      )}
      <ul className="profit-split__legend">
        {parts.map((part) => (
          <li key={part.key}>
            <i className={`is-${part.key}`} aria-hidden="true" />
            {part.label} <b>{money(part.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sales beside total costs for each month, with the profit or loss above. */
function MonthlyChart({
  months,
  selected,
  onSelect,
}: {
  months: ApiProfitMonth[];
  selected: string;
  onSelect: (month: string) => void;
}) {
  const top = Math.max(1, ...months.map((month) => Math.max(month.sales, costsOf(month))));
  return (
    <div className="profit-chart" role="group" aria-label="Sales and costs per month">
      {months.map((month) => (
        <button
          key={month.month}
          type="button"
          className={`profit-chart__month${month.month === selected ? ' is-selected' : ''}`}
          onClick={() => onSelect(month.month)}
          title={`${monthName(month.month)}: sales ${money(month.sales)}, costs ${money(costsOf(month))}`}
        >
          <span className={`profit-chart__result${month.profit < 0 ? ' is-loss' : ''}`}>
            {month.profit < 0 ? '−' : '+'}
            {money(Math.abs(month.profit))}
          </span>
          <span className="profit-chart__bars">
            <span
              className="profit-chart__bar is-sales"
              style={{ height: `${(month.sales / top) * 100}%` }}
            />
            <span
              className="profit-chart__bar is-costs"
              style={{ height: `${(costsOf(month) / top) * 100}%` }}
            />
          </span>
          <span className="profit-chart__label">{monthName(month.month, 'short')}</span>
        </button>
      ))}
    </div>
  );
}

export function ProfitReport() {
  const [count, setCount] = useState(6);
  const [months, setMonths] = useState<ApiProfitMonth[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    getProfit(count)
      .then((list) => {
        if (!current) return;
        setMonths(list);
        setSelected((now) =>
          list.some((month) => month.month === now) ? now : (list.at(-1)?.month ?? ''),
        );
      })
      .catch((error: unknown) => {
        if (current) setLoadError(error instanceof Error ? error.message : 'Could not load.');
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [count]);

  const month = months.find((item) => item.month === selected);
  const totalProfit = months.reduce((sum, item) => sum + item.profit, 0);

  return (
    <>
      <div className="duty-reports__filters">
        <label>
          Show
          <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </label>
      </div>
      {loading && <LoadingState label="Adding up sales and costs…" />}
      {loadError && <ErrorState message={loadError} />}
      {!loading && !loadError && month && (
        <>
          <section
            className={`profit-verdict${month.profit < 0 ? ' is-loss' : ''}`}
            aria-live="polite"
          >
            <p>{monthName(month.month)}</p>
            <strong>
              {month.profit < 0 ? 'Loss' : 'Profit'} {money(Math.abs(month.profit))}
            </strong>
            <span>
              Sales {money(month.sales)} − costs {money(costsOf(month))}
            </span>
          </section>

          <WhereMoneyWent month={month} />

          <h4 className="credit-section-title">Month by month · tap a month to see it above</h4>
          <MonthlyChart months={months} selected={selected} onSelect={setSelected} />
          <p className="profit-chart__key">
            <i className="is-sales" aria-hidden="true" /> Sales{' '}
            <i className="is-costs" aria-hidden="true" /> Costs (items sold, expenses, free items,
            stock lost) · {months.length} months total:{' '}
            <b className={totalProfit < 0 ? 'is-loss' : ''}>
              {totalProfit < 0 ? 'loss' : 'profit'} {money(Math.abs(totalProfit))}
            </b>
          </p>

          <h4 className="credit-section-title">{monthName(month.month)} in numbers</h4>
          <table className="stock-index__table profit-table">
            <tbody>
              <tr>
                <td>Sales (cash, GCash and utang, after discounts)</td>
                <td>{money(month.sales)}</td>
              </tr>
              <tr>
                <td>Less: cost of the items sold</td>
                <td>−{money(month.costOfGoods)}</td>
              </tr>
              {Object.entries(month.expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <tr key={category}>
                    <td>Less: {category}</td>
                    <td>−{money(amount)}</td>
                  </tr>
                ))}
              {month.freeItems > 0 && (
                <tr>
                  <td>Less: items given free (no charge), at cost</td>
                  <td>−{money(month.freeItems)}</td>
                </tr>
              )}
              {month.stockLosses !== 0 && (
                <tr>
                  <td>Less: stock damaged, missing or recounted, at cost</td>
                  <td>−{money(month.stockLosses)}</td>
                </tr>
              )}
              <tr className={`profit-table__total${month.profit < 0 ? ' is-loss' : ''}`}>
                <td>{month.profit < 0 ? 'Loss' : 'Profit'}</td>
                <td>{money(month.profit)}</td>
              </tr>
            </tbody>
          </table>
          <p className="register-empty">
            Cash taken home by the owner this month: <b>{money(month.cashToOwner)}</b>. It is your
            money from the drawer, not a cost, so it does not lower the profit.
            {month.unitsWithoutCost > 0 &&
              ` ${month.unitsWithoutCost} sold units have no purchase cost recorded, so the profit is higher than it really is: add the cost when receiving stock.`}{' '}
            Utang sales count when sold, even if not paid yet.
          </p>
        </>
      )}
    </>
  );
}
