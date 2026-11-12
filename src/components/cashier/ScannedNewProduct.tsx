import { FormEvent, useEffect, useState } from 'react';
import { getInventory, type InventoryProduct } from '../../data/inventoryStore';
import { syncCatalog } from '../../data/serverSync';
import { notifyBillingChanged } from '../../services/useBilling';
import { createProduct, lookupBarcode } from '../../services/storeApi';

/*
 * Sales Counter: a scanned barcode that is not on the product list. The details are looked up,
 * the cashier sets the price, and OK adds it to the sale. It is saved as an unregistered
 * product, listed under Products > Unregistered until someone registers it (cost, stock, batch).
 */

const UNITS = ['Tablet', 'Capsule', 'Sachet', 'Bottle', 'Tube', 'Pack', 'Box', 'Piece'];

export function ScannedNewProduct({
  barcode,
  onCancel,
  onAdded,
}: {
  barcode: string;
  onCancel: () => void;
  onAdded: (product: InventoryProduct) => void;
}) {
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading');
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [strength, setStrength] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('Piece');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    lookupBarcode(barcode)
      .then((result) => {
        notifyBillingChanged(); // a lookup may use a free scan
        if (!alive) return;
        if (result.status === 'found') {
          const found = result.suggestion;
          setName(found.name);
          setDetail(found.brand ?? '');
          setStrength(found.strength ?? '');
          setCategory(found.category ?? '');
          if (found.unit && UNITS.includes(found.unit)) setUnit(found.unit);
          setState('found');
        } else {
          setState('missing');
        }
      })
      .catch(() => alive && setState('missing'));
    return () => {
      alive = false;
    };
  }, [barcode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(price);
    if (!name.trim()) return setError('Type the product name.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Set the selling price.');
    setSaving(true);
    setError('');
    try {
      const fullName = strength && !name.includes(strength) ? `${name.trim()} ${strength}` : name;
      const saved = await createProduct({
        name: fullName.trim(),
        barcode,
        detail: detail.trim() || fullName.trim(),
        category: category.trim() || 'Other',
        unit,
        price: Math.round(amount * 100) / 100,
        unregistered: true,
      });
      await syncCatalog();
      const product = getInventory().find((item) => item.id === saved.id);
      if (!product) throw new Error('Saved, but the product list did not refresh. Scan it again.');
      onAdded(product);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the product.');
      setSaving(false);
    }
  }

  return (
    <div
      className="pos-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <form className="pos-payment-modal pos-new-product" onSubmit={(event) => void submit(event)}>
        <button className="pos-modal-close" type="button" onClick={onCancel} aria-label="Close">
          ×
        </button>
        <p className="pos-new-product__flag">New product found</p>
        <h2>Not in the stock list yet</h2>
        <p className="pos-new-product__code">Barcode {barcode}</p>

        {state === 'loading' ? (
          <p className="pos-new-product__loading" role="status">
            Getting the product details, this may take a few seconds…
          </p>
        ) : (
          <>
            <p className="pos-new-product__note">
              {state === 'found'
                ? 'Check the details, then set the selling price.'
                : 'No details were found for this barcode. Type the name and set the price.'}
            </p>
            <div className="pos-new-product__grid">
              <label className="is-wide">
                Product name
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Strength / size
                <input
                  value={strength}
                  onChange={(event) => setStrength(event.target.value)}
                  placeholder="e.g. 500 mg, 60 ml"
                />
              </label>
              <label>
                Sold as
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                  {UNITS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="is-wide">
                Generic / brand
                <input
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="e.g. Paracetamol / Unilab"
                />
              </label>
              <label className="is-wide pos-new-product__price">
                Selling price (₱ per {unit.toLowerCase()})
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                />
              </label>
            </div>
            <p className="pos-new-product__hint">
              It is added to this sale and saved under Products › Unregistered, where the cost,
              stock, batch and expiry can be filled in later.
            </p>
            {error && (
              <p className="pos-new-product__error" role="alert">
                {error}
              </p>
            )}
            <div className="pos-new-product__actions">
              <button type="button" className="cashier-view-button" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="cashier-primary-action" disabled={saving}>
                {saving ? 'Adding…' : 'OK, add to sale'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
