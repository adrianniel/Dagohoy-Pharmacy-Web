import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentAccount } from '../../data/accountStore';
import type { InventoryProduct } from '../../data/inventoryStore';
import type { InventoryBatch } from '../../data/operationsStore';
import { lastLotCost, newestLot, suggestedOrder } from '../../data/lotCost';
import { downloadPdf } from '../../lib/pdf';
import { readStore } from '../../data/storeInfo';

/*
 * Order for restock: the low-stock products are listed, the user ticks the ones to order and
 * sets each quantity (a suggestion is filled in, never fixed), then generates an A4 order list
 * to preview and save as PDF. The estimate uses the last purchase cost of each product.
 */

const peso = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

type Line = {
  product: InventoryProduct;
  suggested: number;
  unitCost?: number;
  supplier?: string;
};

type OrderDoc = {
  number: string;
  date: string;
  supplier: string;
  preparedBy: string;
  lines: Array<Line & { quantity: number }>;
};

export function RestockOrder({
  products,
  threshold,
  batches,
}: {
  /** Products under the reorder point, lowest stock first. */
  products: InventoryProduct[];
  threshold: number;
  batches: InventoryBatch[];
}) {
  /** Ticked products and the quantity typed for each, by barcode. */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [supplier, setSupplier] = useState('');
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const pdfCopy = useRef<HTMLDivElement>(null);

  const lines: Line[] = products.map((product) => ({
    product,
    suggested: suggestedOrder(product.stock, threshold),
    unitCost: lastLotCost(batches, product.barcode) ?? product.cost,
    supplier: newestLot(batches, product.barcode, (batch) => Boolean(batch.supplier))?.supplier,
  }));
  const quantityOf = (barcode: string) => Math.max(0, Math.floor(Number(picked[barcode]) || 0));
  const chosen = lines.filter((line) => line.product.barcode in picked);
  const ready = chosen.filter((line) => quantityOf(line.product.barcode) > 0);
  const estimate = ready.reduce(
    (sum, line) => sum + (line.unitCost ?? 0) * quantityOf(line.product.barcode),
    0,
  );
  const allPicked = lines.length > 0 && chosen.length === lines.length;

  function toggle(line: Line) {
    setPicked((current) => {
      const next = { ...current };
      if (line.product.barcode in next) delete next[line.product.barcode];
      else next[line.product.barcode] = String(line.suggested);
      return next;
    });
  }

  function toggleAll() {
    setPicked(
      allPicked
        ? {}
        : Object.fromEntries(lines.map((line) => [line.product.barcode, String(line.suggested)])),
    );
  }

  function generate() {
    const now = new Date();
    const stamp = now.toLocaleDateString('en-CA').replaceAll('-', '');
    const time = now.toTimeString().slice(0, 5).replace(':', '');
    setOrder({
      number: `RO-${stamp}-${time}`,
      date: now.toLocaleDateString('en-PH', { dateStyle: 'long' }),
      supplier: supplier.trim(),
      preparedBy: getCurrentAccount()?.displayName ?? '',
      lines: ready.map((line) => ({ ...line, quantity: quantityOf(line.product.barcode) })),
    });
  }

  useEffect(() => {
    if (!saving || !order) return;
    const timer = window.setTimeout(() => {
      if (!pdfCopy.current) return setSaving(false);
      downloadPdf(pdfCopy.current, `Restock order ${order.number}`)
        .catch(() => window.alert('The PDF could not be made. Please try again.'))
        .finally(() => setSaving(false));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [saving, order]);

  if (order) {
    return (
      <div className="restock-preview">
        <div className="stock-index__actions restock-preview__bar">
          <button
            className="stock-index__action restock-preview__back"
            type="button"
            onClick={() => setOrder(null)}
          >
            Back to the list
          </button>
          <button
            className="stock-index__action"
            type="button"
            onClick={() => setSaving(true)}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save as PDF'}
          </button>
        </div>
        <RestockOrderDocument order={order} />
        {saving &&
          createPortal(
            <div className="pdf-render-root" ref={pdfCopy} aria-hidden="true">
              <RestockOrderDocument order={order} />
            </div>,
            document.body,
          )}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="stock-index__empty">
        Every product is above the {threshold}-unit reorder point. Nothing to order.
      </p>
    );
  }

  return (
    <div className="restock-pick">
      <p className="stock-index__note">
        Tick the products to order. The quantity is a suggestion (it brings the shelf back to{' '}
        {threshold * 2} units): change it to what you really want to order.
      </p>
      <table className="stock-index__table restock-pick__table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allPicked}
                onChange={toggleAll}
                aria-label="Select all low-stock products"
              />
            </th>
            <th>Product</th>
            <th>On hand</th>
            <th>Suggested</th>
            <th>Order qty</th>
            <th>Last cost</th>
            <th>Est. amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const { barcode } = line.product;
            const on = barcode in picked;
            const quantity = quantityOf(barcode);
            return (
              <tr key={barcode} className={on ? 'is-picked' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(line)}
                    aria-label={`Order ${line.product.product}`}
                  />
                </td>
                <td>
                  <strong>{line.product.product}</strong>
                  <small className="stock-index__sub">
                    {line.product.detail}
                    {line.supplier && ` · last from ${line.supplier}`}
                  </small>
                </td>
                <td className={line.product.stock <= 0 ? 'restock-pick__out' : ''}>
                  {line.product.stock <= 0 ? 'Out' : line.product.stock}
                </td>
                <td>{line.suggested}</td>
                <td>
                  <input
                    className="restock-pick__qty"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={on ? picked[barcode] : ''}
                    placeholder={String(line.suggested)}
                    disabled={!on}
                    onChange={(event) =>
                      setPicked((current) => ({ ...current, [barcode]: event.target.value }))
                    }
                    aria-label={`Quantity of ${line.product.product}`}
                  />{' '}
                  <small>{line.product.unit.toLowerCase()}s</small>
                </td>
                <td>{line.unitCost !== undefined ? peso(line.unitCost) : '—'}</td>
                <td>
                  {on && line.unitCost !== undefined && quantity > 0
                    ? peso(line.unitCost * quantity)
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="restock-pick__foot">
        <label>
          Supplier (optional)
          <input
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
            placeholder="Who the order is for"
          />
        </label>
        <p>
          <span>
            {ready.length} item{ready.length === 1 ? '' : 's'} selected
          </span>
          <strong>Estimated {peso(estimate)}</strong>
        </p>
        <button
          className="stock-index__action"
          type="button"
          onClick={generate}
          disabled={ready.length === 0}
        >
          Generate order list
        </button>
      </div>
    </div>
  );
}

/** The A4 order list: shown as the preview and drawn off screen for the PDF. */
function RestockOrderDocument({ order }: { order: OrderDoc }) {
  const store = readStore();
  const total = order.lines.reduce((sum, line) => sum + (line.unitCost ?? 0) * line.quantity, 0);
  const missingCost = order.lines.some((line) => line.unitCost === undefined);
  return (
    <article className="shift-doc restock-doc">
      <header className="shift-doc__head">
        <div>
          <strong>{store.name}</strong>
          {store.address && <span>{store.address}</span>}
          {store.phone && <span>Tel: {store.phone}</span>}
        </div>
        <div className="shift-doc__title">
          <h2>Restock order list</h2>
          <span>{order.number}</span>
        </div>
      </header>
      <dl className="shift-doc__facts">
        <div>
          <dt>Date</dt>
          <dd>{order.date}</dd>
        </div>
        <div>
          <dt>Supplier</dt>
          <dd>{order.supplier || '—'}</dd>
        </div>
        <div>
          <dt>Items</dt>
          <dd>{order.lines.length}</dd>
        </div>
        <div>
          <dt>Prepared by</dt>
          <dd>{order.preparedBy || '—'}</dd>
        </div>
      </dl>
      <table className="restock-doc__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Barcode</th>
            <th>Quantity</th>
            <th>Last unit cost</th>
            <th>Est. amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, index) => (
            <tr key={line.product.barcode}>
              <td>{index + 1}</td>
              <td>
                <strong>{line.product.product}</strong>
                {line.product.detail && <small>{line.product.detail}</small>}
              </td>
              <td>{line.product.barcode}</td>
              <td>
                {line.quantity} {line.product.unit.toLowerCase()}
                {line.quantity === 1 ? '' : 's'}
              </td>
              <td>{line.unitCost !== undefined ? peso(line.unitCost) : '—'}</td>
              <td>{line.unitCost !== undefined ? peso(line.unitCost * line.quantity) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>Estimated total</td>
            <td>{peso(total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="restock-doc__note">
        Amounts are estimates from the last purchase cost of each product; the supplier's prices may
        differ.
        {missingCost && ' Products marked — have no purchase cost recorded yet.'}
      </p>
      <div className="restock-doc__sign">
        <span>Prepared by</span>
        <span>Approved by</span>
      </div>
    </article>
  );
}
