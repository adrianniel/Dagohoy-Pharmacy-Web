import { useState, type FormEvent } from 'react';
import type { InventoryBatch } from '../../data/operationsStore';
import { setLotPrices } from '../../services/storeApi';
import { useToast } from '../toast';

const peso = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const shortDate = (date: string) =>
  date
    ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`))
    : 'No expiry';

const lotName = (lot: string) => (lot.startsWith('TBD-') ? 'No batch no. yet' : lot);

/**
 * The batches of one product, under its row in the product list: how many units each has,
 * its cost and its selling price (a batch without its own price sells at the product's).
 * Edit sets a batch's own cost and price.
 */
export function ProductBatches({
  batches,
  productPrice,
  onSaved,
}: {
  batches: InventoryBatch[];
  /** The product's price, used by batches without their own; null: no price yet. */
  productPrice: number | null;
  onSaved: () => Promise<void> | void;
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  function start(batch: InventoryBatch) {
    setEditing(batch.id);
    setCost(batch.unitCost !== undefined ? String(batch.unitCost) : '');
    setPrice(batch.sellingPrice !== undefined ? String(batch.sellingPrice) : '');
  }

  async function save(event: FormEvent<HTMLFormElement>, batch: InventoryBatch) {
    event.preventDefault();
    const costValue = cost.trim() === '' ? null : Number(cost);
    const priceValue = price.trim() === '' ? null : Number(price);
    if (costValue !== null && !(Number.isFinite(costValue) && costValue >= 0)) {
      showToast('Type the cost as a number, like 70, or leave it blank.', 'error');
      return;
    }
    if (priceValue !== null && !(Number.isFinite(priceValue) && priceValue > 0)) {
      showToast('Type the selling price as a number above 0, or leave it blank.', 'error');
      return;
    }
    setSaving(true);
    try {
      await setLotPrices(Number(batch.id), { unitCost: costValue, sellingPrice: priceValue });
      await onSaved();
      setEditing(null);
      showToast(`Batch ${lotName(batch.lot)} saved.`);
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Could not save the batch.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ul className="product-batches" aria-label="Batches of this product">
      {batches.map((batch) => {
        const sells = batch.sellingPrice ?? productPrice;
        return (
          <li key={batch.id} className="product-batches__item">
            {editing === batch.id ? (
              <form className="product-batches__edit" onSubmit={(event) => void save(event, batch)}>
                <strong>{lotName(batch.lot)}</strong>
                <label>
                  Cost / unit
                  <input
                    value={cost}
                    onChange={(event) => setCost(event.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    placeholder="Not set"
                  />
                </label>
                <label>
                  Selling price / unit
                  <input
                    value={price}
                    onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    placeholder={productPrice ? `${productPrice} (product price)` : 'Not set'}
                    autoFocus
                  />
                </label>
                <span className="product-batches__actions">
                  <button className="cashier-primary-action" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className="cashier-view-button"
                    type="button"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </span>
              </form>
            ) : (
              <>
                <span className="product-batches__lot">
                  <strong>{lotName(batch.lot)}</strong>
                  <small>
                    {batch.stock} on hand · {shortDate(batch.expiry)}
                    {batch.supplier ? ` · ${batch.supplier}` : ''}
                  </small>
                </span>
                <span className="product-batches__money">
                  <small>Cost</small>
                  <b>{batch.unitCost !== undefined ? peso(batch.unitCost) : 'Not set'}</b>
                </span>
                <span className="product-batches__money">
                  <small>Sells at</small>
                  <b>
                    {sells !== null ? peso(sells) : 'No price'}
                    {batch.sellingPrice === undefined && sells !== null && <i> (product price)</i>}
                  </b>
                </span>
                <button className="cashier-view-button" type="button" onClick={() => start(batch)}>
                  Edit
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
