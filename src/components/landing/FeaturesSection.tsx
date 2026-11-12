import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import './features-index.css';

/*
 * Features: an index of the eight tools on the left, and on the right the system's own screen
 * for the one picked (a phone shows it inside the picked row). Picked by click, tap or the arrow
 * keys; nothing changes on its own and nothing moves because the page scrolled.
 */

type Feature = {
  title: string;
  role: 'Cashier' | 'Owner' | 'Both';
  screen: string;
  text: string;
  preview: () => ReactNode;
};

const peso = (amount: number) =>
  `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const features: Feature[] = [
  {
    title: 'Barcode scanning',
    role: 'Both',
    screen: 'Sales Counter',
    text: 'Scan a box and it is found in a second. A box the store has never sold fills in its own name and details.',
    preview: ScanPreview,
  },
  {
    title: 'Sales Counter',
    role: 'Cashier',
    screen: 'Sales Counter',
    text: 'Scan, set the quantity, take a peso discount, then cash, GCash or credit. Every sale goes to the record.',
    preview: SalePreview,
  },
  {
    title: 'Batches and expiry',
    role: 'Owner',
    screen: 'Stock',
    text: 'Each delivery keeps its batch number and expiry date, and the batch that expires first is sold first.',
    preview: BatchPreview,
  },
  {
    title: 'Expiry watch',
    role: 'Owner',
    screen: 'Stock',
    text: 'Medicines near their expiry are listed early, to sell first or return to the supplier.',
    preview: ExpiryPreview,
  },
  {
    title: 'Receiving and restock',
    role: 'Owner',
    screen: 'Receive stock',
    text: 'Log a delivery with its cost and supplier. Low stock turns into an order list ready to print.',
    preview: ReceivePreview,
  },
  {
    title: 'Shifts and cash drawer',
    role: 'Cashier',
    screen: 'Shift',
    text: 'Open with a float, record cash paid in and out, and count the drawer when the shift closes.',
    preview: ShiftPreview,
  },
  {
    title: 'Customer credit (utang)',
    role: 'Both',
    screen: 'Credits',
    text: 'See who owes what. Each payment comes off the balance the moment it is recorded.',
    preview: CreditPreview,
  },
  {
    title: 'Sales and profit reports',
    role: 'Owner',
    screen: 'Reports',
    text: 'Daily sales and profit by product, open to the owner from anywhere with internet.',
    preview: ReportPreview,
  },
];

export function FeaturesSection() {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function pick(index: number, focus = false) {
    const next = (index + features.length) % features.length;
    setActive(next);
    if (focus) tabs.current[next]?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: features.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    pick(moves[event.key], true);
  }

  const current = features[active];

  return (
    <section className="feat" id="features" aria-labelledby="features-title">
      <div className="feat__wrap">
        <header className="feat__head">
          <h2 id="features-title">
            <span>From the shelf</span> <span>to the cash drawer.</span>
          </h2>
          <p>
            Eight tools the owner and the cashier use every day, all saving to one record. Pick one
            to see its screen.
          </p>
        </header>

        <div className="feat__body">
          <div className="feat__index" role="tablist" aria-orientation="vertical">
            {features.map((feature, index) => {
              const on = index === active;
              return (
                <div className={`feat__row${on ? ' is-active' : ''}`} key={feature.title}>
                  <button
                    ref={(node) => {
                      tabs.current[index] = node;
                    }}
                    className="feat__tab"
                    type="button"
                    role="tab"
                    id={`feat-tab-${index}`}
                    aria-selected={on}
                    aria-controls="feat-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => pick(index)}
                    onKeyDown={(event) => onKey(event, index)}
                  >
                    <span className="feat__num">{String(index + 1).padStart(2, '0')}</span>
                    <span className="feat__title">{feature.title}</span>
                    <span className="feat__role">{feature.role}</span>
                    <span className="feat__arrow" aria-hidden="true">
                      <svg viewBox="0 0 16 16">
                        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
                      </svg>
                    </span>
                  </button>
                  <div className="feat__more">
                    <div>
                      <p className="feat__text">{feature.text}</p>
                      {on && (
                        <div className="feat__inline" aria-hidden="true">
                          <Screen feature={feature} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="feat__stage"
            id="feat-panel"
            role="tabpanel"
            aria-labelledby={`feat-tab-${active}`}
          >
            <Screen feature={current} key={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The system's own window: its header with the screen name, then that screen's content. */
function Screen({ feature }: { feature: Feature }) {
  const Preview = feature.preview;
  return (
    <div className="feat-app">
      <div className="feat-app__bar">
        <span className="feat-app__brand">Dagohoy Pharmacy</span>
        <span className="feat-app__screen">{feature.screen}</span>
        <span className="feat-app__online">
          <i /> Online
        </span>
      </div>
      <div className="feat-app__body">
        <Preview />
      </div>
    </div>
  );
}

function ScanPreview() {
  return (
    <div className="fp-scan">
      <div className="fp-scan__code" aria-hidden="true">
        <span className="fp-scan__bars" />
        <span className="fp-scan__beam" />
        <span className="fp-scan__digits">4 800016 644012</span>
      </div>
      <div className="fp-field">
        <span className="fp-field__label">Scan or type a barcode</span>
        <span className="fp-field__value fp-scan__typed">4800016644012</span>
      </div>
      <div className="fp-found">
        <span className="fp-found__flag">Found</span>
        <strong>Biogesic Paracetamol 500 mg</strong>
        <span>Tablet · {peso(5.5)} · 248 on hand</span>
      </div>
    </div>
  );
}

function SalePreview() {
  const lines = [
    ['Biogesic 500 mg', 10, 55],
    ['Neozep Forte', 4, 30],
    ['Betadine 60 ml', 1, 168],
  ] as const;
  return (
    <div className="fp-sale">
      <ul className="fp-lines">
        {lines.map(([name, qty, amount], index) => (
          <li key={name} className={index === lines.length - 1 ? 'is-new' : undefined}>
            <span>{name}</span>
            <span className="fp-muted">×{qty}</span>
            <span>{peso(amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="fp-sum">
        <div>
          <dt>Subtotal</dt>
          <dd>{peso(253)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>−{peso(10)}</dd>
        </div>
        <div className="is-total">
          <dt>Total</dt>
          <dd>{peso(243)}</dd>
        </div>
      </dl>
      <div className="fp-pay">
        <span className="is-on">Cash</span>
        <span>GCash</span>
        <span>Credit</span>
      </div>
      <span className="fp-button">Save sale</span>
    </div>
  );
}

function BatchPreview() {
  const rows = [
    ['AMX-2405', 'Feb 2027', 60],
    ['AMX-2411', 'Aug 2027', 200],
    ['AMX-2502', 'Jan 2028', 300],
  ] as const;
  return (
    <div className="fp-batch">
      <p className="fp-heading">
        Amoxicillin 500 mg <span className="fp-muted">· 560 capsules</span>
      </p>
      <table className="fp-table">
        <thead>
          <tr>
            <th>Batch</th>
            <th>Expires</th>
            <th>On hand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([batch, expiry, qty], index) => (
            <tr key={batch} className={index === 0 ? 'is-next' : undefined}>
              <td>
                {batch}
                {index === 0 && <span className="fp-tag">Sells first</span>}
              </td>
              <td>{expiry}</td>
              <td>{qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpiryPreview() {
  const rows = [
    ['Cetirizine 10 mg', 12, 'is-red'],
    ['Ascorbic Acid 500 mg', 41, 'is-amber'],
    ['Losartan 50 mg', 77, ''],
  ] as const;
  return (
    <div className="fp-expiry">
      <p className="fp-heading">Expiring within 90 days</p>
      <ul>
        {rows.map(([name, days, tone]) => (
          <li key={name} className={tone}>
            <span className="fp-dot" />
            <span>{name}</span>
            <span className="fp-meter">
              <i style={{ width: `${(days / 90) * 100}%` }} />
            </span>
            <span className="fp-days">{days} days</span>
          </li>
        ))}
      </ul>
      <span className="fp-button is-ghost">Return to supplier</span>
    </div>
  );
}

function ReceivePreview() {
  return (
    <div className="fp-receive">
      <div className="fp-grid">
        <div className="fp-field">
          <span className="fp-field__label">Product</span>
          <span className="fp-field__value">Biogesic 500 mg</span>
        </div>
        <div className="fp-field">
          <span className="fp-field__label">Batch</span>
          <span className="fp-field__value">BG-2503</span>
        </div>
        <div className="fp-field">
          <span className="fp-field__label">Expiry</span>
          <span className="fp-field__value">Mar 2028</span>
        </div>
        <div className="fp-field">
          <span className="fp-field__label">Quantity</span>
          <span className="fp-field__value">500 tablets</span>
        </div>
      </div>
      <div className="fp-stockline">
        <span className="fp-muted">On hand</span>
        <span className="fp-count">
          <b className="fp-count__from">248</b>
          <b className="fp-count__to">748</b>
        </span>
        <span className="fp-up">+500</span>
      </div>
    </div>
  );
}

function ShiftPreview() {
  const rows = [
    ['Opening float', 1000],
    ['Cash sales', 8420],
    ['Paid out', -350],
  ] as const;
  return (
    <div className="fp-shift">
      <dl className="fp-sum">
        {rows.map(([label, amount]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{amount < 0 ? `−${peso(-amount)}` : peso(amount)}</dd>
          </div>
        ))}
        <div className="is-total">
          <dt>Expected in drawer</dt>
          <dd>{peso(9070)}</dd>
        </div>
        <div>
          <dt>Counted</dt>
          <dd>{peso(9070)}</dd>
        </div>
      </dl>
      <div className="fp-balanced">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5 10 17.5 19 7.5" />
        </svg>
        Drawer balanced · {peso(0)} difference
      </div>
    </div>
  );
}

function CreditPreview() {
  const rows = [
    ['Aling Rosa', 420, 'Since Nov 2'],
    ['Mang Ben', 185.5, 'Since Nov 8'],
    ['Liza', 0, 'Paid today'],
  ] as const;
  return (
    <div className="fp-credit">
      <ul>
        {rows.map(([name, balance, note]) => (
          <li key={name} className={balance === 0 ? 'is-paid' : undefined}>
            <span className="fp-avatar">{name.split(' ').pop()?.[0]}</span>
            <span>
              <strong>{name}</strong>
              <small className="fp-muted">{note}</small>
            </span>
            <span className="fp-balance">{balance === 0 ? 'Paid' : peso(balance)}</span>
          </li>
        ))}
      </ul>
      <p className="fp-muted fp-foot">Open balance {peso(605.5)} · 2 customers</p>
    </div>
  );
}

function ReportPreview() {
  const days = [
    ['Mon', 52],
    ['Tue', 64],
    ['Wed', 48],
    ['Thu', 71],
    ['Fri', 83],
    ['Sat', 96],
    ['Sun', 58],
  ] as const;
  return (
    <div className="fp-report">
      <div className="fp-kpis">
        <div>
          <span className="fp-muted">Sales this week</span>
          <strong>{peso(41280)}</strong>
        </div>
        <div>
          <span className="fp-muted">Profit</span>
          <strong>{peso(9615)}</strong>
        </div>
      </div>
      <div className="fp-bars" aria-hidden="true">
        {days.map(([day, value], index) => (
          <span key={day} className={day === 'Sat' ? 'is-top' : undefined}>
            <i style={{ height: `${value}%`, animationDelay: `${index * 45}ms` }} />
            <small>{day}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
