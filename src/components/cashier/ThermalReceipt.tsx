/*
 * The sales record of one sale, shown on screen in the style of a store slip (monospace,
 * dashed rules, right-aligned amounts). It is an internal record for the store and is not
 * printed or given to customers. One component, so the record after a sale and the record
 * opened again from Transactions are always the same.
 */

export type ReceiptLine = { product: string; quantity: number; unitPrice: number };

export type ReceiptData = {
  receipt: string;
  date: string;
  cashier?: string;
  customer?: string;
  payment: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid?: number;
  change?: number;
  gcashReference?: string;
  paymentStatus?: string;
  creditBalance?: number;
  noChargeReason?: string;
  /** "Voided" prints a VOID stamp with the reason. */
  status?: string;
  voidReason?: string;
  voidedAt?: string;
};

const amount = (value: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

function dateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('en-PH', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })} ${date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

/** Store details shown on the record header, from Owner → Settings. */
function readStoreDetails() {
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

export function ThermalReceipt({ data }: { data: ReceiptData }) {
  const store = readStoreDetails();
  const itemCount = data.lines.reduce((sum, line) => sum + line.quantity, 0);
  const reference = data.gcashReference
    ? data.gcashReference.length < 13
      ? `…${data.gcashReference}`
      : data.gcashReference
    : '—';
  const voided = data.status === 'Voided';

  return (
    <article
      className={`thermal${voided ? ' is-voided' : ''}`}
      aria-label={`Sales record ${data.receipt}`}
    >
      {voided && (
        <span className="thermal__void" aria-hidden="true">
          VOID
        </span>
      )}
      <header className="thermal__head">
        <strong>{store.name.toUpperCase()}</strong>
        {store.address && <span>{store.address}</span>}
        {store.phone && <span>Tel: {store.phone}</span>}
      </header>
      <p className="thermal__title">
        {data.payment === 'No charge' ? 'NO-CHARGE RECORD' : 'SALES RECORD'}
      </p>
      <div className="thermal__rule" />
      <dl className="thermal__meta">
        <div>
          <dt>Record #</dt>
          <dd>{data.receipt}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{dateTime(data.date)}</dd>
        </div>
        {data.cashier && (
          <div>
            <dt>Cashier</dt>
            <dd>{data.cashier}</dd>
          </div>
        )}
        {data.customer && (
          <div>
            <dt>Customer</dt>
            <dd>{data.customer}</dd>
          </div>
        )}
      </dl>
      <div className="thermal__rule" />
      <div className="thermal__cols" aria-hidden="true">
        <span>ITEM</span>
        <span>AMOUNT</span>
      </div>
      <ul className="thermal__items">
        {data.lines.length === 0 && <li className="thermal__note">No item details saved.</li>}
        {data.lines.map((line, index) => (
          <li key={`${line.product}-${index}`}>
            <span className="thermal__name">{line.product}</span>
            <span className="thermal__row">
              <span>
                {line.quantity} x {amount(line.unitPrice)}
              </span>
              <span>{amount(line.unitPrice * line.quantity)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="thermal__rule" />
      <div className="thermal__row">
        <span>
          SUBTOTAL ({itemCount} item{itemCount === 1 ? '' : 's'})
        </span>
        <span>{amount(data.subtotal)}</span>
      </div>
      {data.discount > 0 && (
        <div className="thermal__row">
          <span>DISCOUNT</span>
          <span>-{amount(data.discount)}</span>
        </div>
      )}
      <div className="thermal__rule thermal__rule--double" />
      <div className="thermal__row thermal__total">
        <span>TOTAL</span>
        <span>PHP {amount(data.total)}</span>
      </div>
      <div className="thermal__rule thermal__rule--double" />
      {data.payment === 'Cash' && (
        <>
          <div className="thermal__row">
            <span>CASH</span>
            <span>{amount(data.amountPaid ?? data.total)}</span>
          </div>
          <div className="thermal__row">
            <span>CHANGE</span>
            <span>{amount(data.change ?? 0)}</span>
          </div>
        </>
      )}
      {data.payment === 'GCash' && (
        <>
          <div className="thermal__row">
            <span>GCASH</span>
            <span>{amount(data.total)}</span>
          </div>
          <div className="thermal__row">
            <span>REF NO.</span>
            <span>{reference}</span>
          </div>
          <div className="thermal__row">
            <span>STATUS</span>
            <span>{data.paymentStatus === 'Paid' ? 'CONFIRMED' : 'PENDING'}</span>
          </div>
        </>
      )}
      {data.payment === 'Credit' && (
        <>
          <div className="thermal__row">
            <span>CASH PAID</span>
            <span>{amount(data.amountPaid ?? 0)}</span>
          </div>
          <div className="thermal__row thermal__strong">
            <span>BALANCE (UTANG)</span>
            <span>{amount(data.creditBalance ?? 0)}</span>
          </div>
        </>
      )}
      {data.payment === 'No charge' && data.noChargeReason && (
        <p className="thermal__note">Reason: {data.noChargeReason}</p>
      )}
      {voided && (
        <>
          <div className="thermal__rule" />
          <p className="thermal__note thermal__strong">
            VOIDED{data.voidedAt ? ` ${dateTime(data.voidedAt)}` : ''}
            {data.voidReason ? ` · ${data.voidReason}` : ''}
          </p>
        </>
      )}
      <div className="thermal__rule" />
      <footer className="thermal__foot">
        <strong>INTERNAL STORE RECORD</strong>
        <span>For the store's records only. Not given to customers.</span>
      </footer>
    </article>
  );
}
