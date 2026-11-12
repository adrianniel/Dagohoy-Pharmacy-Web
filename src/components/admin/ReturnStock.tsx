import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getInventory } from '../../data/inventoryStore';
import type { InventoryBatch, StockMovement } from '../../data/operationsStore';
import { syncAfterStockChange } from '../../data/serverSync';
import { readStore } from '../../data/storeInfo';
import { downloadPdf } from '../../lib/pdf';
import { adjustStockMany } from '../../services/storeApi';
import { ProductPicker } from '../ScanInput';
import { useToast } from '../toast';

/*
 * Return stocks to the supplier, many items at a time with one reason:
 *  1. Expired batches still on the shelf: tick them (units default to all of the batch).
 *  2. Any other items: add rows by product (and batch), each with its own units.
 * Everything in one save goes through together or not at all. The list of returns can be
 * previewed and saved as an A4 PDF for the owner.
 */

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
const daysUntil = (date: string) =>
  Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
/** The server writes the batch at the end of the reason: "Batch expired (batch ABC-1)". */
const batchOf = (reason: string) => /\((?:batch|lot) ([^)]+)\)\s*$/i.exec(reason)?.[1] ?? '';
const reasonOf = (reason: string) => reason.replace(/\s*\((?:batch|lot) [^)]+\)\s*$/i, '');

type Row = { key: number; barcode: string; batchId: string; units: string };

export function ReturnStock({
  batches,
  returns,
  initialBatchId = '',
  onSaved,
}: {
  batches: InventoryBatch[];
  returns: StockMovement[];
  /** A batch picked with Return on the expiry check: ticked, or added as a row. */
  initialBatchId?: string;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const live = getInventory().filter((product) => !product.unregistered);
  const expired = batches.filter((batch) => batch.stock > 0 && daysUntil(batch.expiry) < 0);
  /** Ticked expired batches and the units going back for each, by batch id. */
  const preset = batches.find((batch) => batch.id === initialBatchId && batch.stock > 0);
  const presetExpired = Boolean(preset && daysUntil(preset.expiry) < 0);
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    preset && presetExpired ? { [preset.id]: String(preset.stock) } : {},
  );
  const [rows, setRows] = useState<Row[]>(() =>
    preset && !presetExpired
      ? [{ key: 0, barcode: preset.barcode, batchId: preset.id, units: String(preset.stock) }]
      : [],
  );
  const [reason, setReason] = useState('Expired');
  const [slip, setSlip] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const pdfCopy = useRef<HTMLDivElement>(null);
  const nextKey = useRef(1);

  const productIdOf = (barcode: string) => live.find((item) => item.barcode === barcode)?.id;
  const allExpiredPicked = expired.length > 0 && expired.every((batch) => batch.id in picked);

  function toggle(batch: InventoryBatch) {
    setPicked((current) => {
      const next = { ...current };
      if (batch.id in next) delete next[batch.id];
      else next[batch.id] = String(batch.stock);
      return next;
    });
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey.current++, barcode: '', batchId: '', units: '' },
    ]);
  }

  const setRow = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const items: Parameters<typeof adjustStockMany>[0] = [];
    const problems: string[] = [];
    for (const [batchId, units] of Object.entries(picked)) {
      const batch = batches.find((item) => item.id === batchId);
      const productId = batch && productIdOf(batch.barcode);
      const quantity = Number(units);
      if (!batch || !productId) continue;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        problems.push(`${batch.product}: enter the units going back.`);
        continue;
      }
      items.push({
        productId,
        batchId: Number(batchId),
        kind: 'supplier-return',
        quantity,
        reason: reason.trim(),
        reference: slip.trim() || undefined,
      });
    }
    for (const row of rows) {
      if (!row.barcode && !row.units) continue;
      const productId = productIdOf(row.barcode);
      const quantity = Number(row.units);
      if (!productId) {
        problems.push('Pick the product on every added row (or remove the row).');
        continue;
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        problems.push('Enter the units going back on every added row.');
        continue;
      }
      items.push({
        productId,
        batchId: row.batchId ? Number(row.batchId) : undefined,
        kind: 'supplier-return',
        quantity,
        reason: reason.trim(),
        reference: slip.trim() || undefined,
      });
    }
    if (problems.length) return showToast(problems[0], 'error');
    if (!items.length) return showToast('Tick an expired batch or add an item to return.', 'error');
    if (!reason.trim()) return showToast('Say why the items go back to the supplier.', 'error');
    setSaving(true);
    try {
      await adjustStockMany(items);
      await syncAfterStockChange();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Could not save the return.', 'error');
      return;
    } finally {
      setSaving(false);
    }
    const units = items.reduce((sum, item) => sum + item.quantity, 0);
    showToast(`${items.length} item(s), ${units} unit(s) returned to the supplier.`);
    setPicked({});
    setRows([]);
    setSlip('');
    onSaved();
  }

  useEffect(() => {
    if (!pdfSaving) return;
    const timer = window.setTimeout(() => {
      if (!pdfCopy.current) return setPdfSaving(false);
      downloadPdf(pdfCopy.current, `Supplier returns ${new Date().toLocaleDateString('en-CA')}`)
        .catch(() => window.alert('The PDF could not be made. Please try again.'))
        .finally(() => setPdfSaving(false));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [pdfSaving]);

  if (preview) {
    return (
      <div className="restock-preview">
        <div className="stock-index__actions restock-preview__bar">
          <button
            className="stock-index__action restock-preview__back"
            type="button"
            onClick={() => setPreview(false)}
          >
            Back to returns
          </button>
          <button
            className="stock-index__action"
            type="button"
            onClick={() => setPdfSaving(true)}
            disabled={pdfSaving}
          >
            {pdfSaving ? 'Saving…' : 'Save as PDF'}
          </button>
        </div>
        <ReturnsDocument returns={returns} />
        {pdfSaving &&
          createPortal(
            <div className="pdf-render-root" ref={pdfCopy} aria-hidden="true">
              <ReturnsDocument returns={returns} />
            </div>,
            document.body,
          )}
      </div>
    );
  }

  return (
    <form className="return-stock" onSubmit={(event) => void submit(event)}>
      <section>
        <h5 className="stock-index__subhead">1. Expired batches still on the shelf</h5>
        {expired.length === 0 ? (
          <p className="stock-index__empty">No expired batch is on the shelf.</p>
        ) : (
          <table className="stock-index__table restock-pick__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allExpiredPicked}
                    onChange={() =>
                      setPicked(
                        allExpiredPicked
                          ? {}
                          : Object.fromEntries(
                              expired.map((batch) => [batch.id, String(batch.stock)]),
                            ),
                      )
                    }
                    aria-label="Select all expired batches"
                  />
                </th>
                <th>Batch</th>
                <th>Product</th>
                <th>Expired</th>
                <th>On the shelf</th>
                <th>Units going back</th>
              </tr>
            </thead>
            <tbody>
              {expired.map((batch) => {
                const on = batch.id in picked;
                return (
                  <tr key={batch.id} className={on ? 'is-picked' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(batch)}
                        aria-label={`Return batch ${batch.lot} of ${batch.product}`}
                      />
                    </td>
                    <td className="stock-index__mono">
                      <strong>{batch.lot}</strong>
                    </td>
                    <td>
                      <strong>{batch.product}</strong>
                    </td>
                    <td className="restock-pick__out">{shortDate(batch.expiry)}</td>
                    <td>{batch.stock}</td>
                    <td>
                      <input
                        className="restock-pick__qty"
                        type="number"
                        min="1"
                        max={batch.stock}
                        value={on ? picked[batch.id] : ''}
                        placeholder={String(batch.stock)}
                        disabled={!on}
                        onChange={(event) =>
                          setPicked((current) => ({ ...current, [batch.id]: event.target.value }))
                        }
                        aria-label={`Units of batch ${batch.lot} going back`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h5 className="stock-index__subhead">2. Other items going back</h5>
        {rows.map((row) => {
          const productBatches = batches.filter(
            (batch) => batch.barcode === row.barcode && batch.stock > 0,
          );
          return (
            <div className="return-stock__row" key={row.key}>
              <label>
                Product
                <ProductPicker
                  products={live}
                  value={row.barcode}
                  onPick={(barcode) => setRow(row.key, { barcode, batchId: '' })}
                />
              </label>
              <label>
                Batch
                <select
                  value={row.batchId}
                  onChange={(event) => setRow(row.key, { batchId: event.target.value })}
                >
                  <option value="">Any (expiring first)</option>
                  {productBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.lot} · exp {shortDate(batch.expiry)} · {batch.stock} on shelf
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Units going back
                <input
                  type="number"
                  min="1"
                  value={row.units}
                  onChange={(event) => setRow(row.key, { units: event.target.value })}
                  placeholder="Units"
                />
              </label>
              <button
                type="button"
                className="return-stock__remove"
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                aria-label="Remove this item"
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="stock-index__action restock-preview__back"
          onClick={addRow}
        >
          + Add an item
        </button>
      </section>

      <section className="return-stock__common">
        <label>
          Reason (for every item)
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Expired, damaged on delivery"
          />
        </label>
        <label>
          Return slip no. (optional)
          <input
            value={slip}
            onChange={(event) => setSlip(event.target.value)}
            placeholder="e.g. RS-24018"
          />
        </label>
        <button className="stock-index__action" type="submit" disabled={saving}>
          {saving
            ? 'Saving…'
            : `Record supplier return (${Object.keys(picked).length + rows.filter((row) => row.barcode).length} item(s))`}
        </button>
      </section>

      <section>
        <div className="return-stock__history-head">
          <h5 className="stock-index__subhead">Returns to suppliers</h5>
          <button
            type="button"
            className="stock-index__action restock-preview__back"
            onClick={() => setPreview(true)}
            disabled={returns.length === 0}
          >
            Preview / save as PDF
          </button>
        </div>
        {returns.length === 0 ? (
          <p className="stock-index__empty">No supplier returns recorded yet.</p>
        ) : (
          <table className="stock-index__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch</th>
                <th>Product</th>
                <th>Units</th>
                <th>Reason</th>
                <th>Return slip</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {returns.slice(0, 10).map((movement) => (
                <tr key={movement.id}>
                  <td className="stock-index__mono">{dateTime(movement.date)}</td>
                  <td className="stock-index__mono">{batchOf(movement.reason) || '—'}</td>
                  <td>
                    <strong>{movement.product}</strong>
                  </td>
                  <td className="movement-negative">{movement.change}</td>
                  <td>{reasonOf(movement.reason)}</td>
                  <td className="stock-index__mono">{movement.reference}</td>
                  <td>{movement.staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </form>
  );
}

/** A4 list of every supplier return, for the owner's copy. */
function ReturnsDocument({ returns }: { returns: StockMovement[] }) {
  const store = readStore();
  const units = returns.reduce((sum, movement) => sum + Math.abs(movement.change), 0);
  return (
    <article className="shift-doc restock-doc">
      <header className="shift-doc__head">
        <div>
          <strong>{store.name}</strong>
          {store.address && <span>{store.address}</span>}
          {store.phone && <span>Tel: {store.phone}</span>}
        </div>
        <div className="shift-doc__title">
          <h2>Returns to suppliers</h2>
          <span>As of {new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}</span>
        </div>
      </header>
      <dl className="shift-doc__facts">
        <div>
          <dt>Returns</dt>
          <dd>{returns.length}</dd>
        </div>
        <div>
          <dt>Units sent back</dt>
          <dd>{units}</dd>
        </div>
      </dl>
      <table className="restock-doc__table return-doc__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Batch</th>
            <th>Product</th>
            <th>Units</th>
            <th>Reason</th>
            <th>Slip</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((movement, index) => (
            <tr key={movement.id}>
              <td>{index + 1}</td>
              <td>{dateTime(movement.date)}</td>
              <td>{batchOf(movement.reason) || '—'}</td>
              <td>
                <strong>{movement.product}</strong>
              </td>
              <td>{Math.abs(movement.change)}</td>
              <td>{reasonOf(movement.reason)}</td>
              <td>{movement.reference}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="restock-doc__sign">
        <span>Prepared by</span>
        <span>Received by (supplier)</span>
      </div>
    </article>
  );
}
