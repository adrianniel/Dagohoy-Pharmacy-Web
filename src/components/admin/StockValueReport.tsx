import { useEffect, useState } from 'react';
import { getInventory } from '../../data/inventoryStore';
import { initialBatches, loadBatches } from '../../data/operationsStore';
import { syncAfterStockChange } from '../../data/serverSync';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';

/*
 * What the stock on the shelf is worth right now: what it cost, what it sells for, and the
 * profit if all of it is sold. Worked out fresh from the batches each time it opens, so it moves
 * with every sale and delivery. Each batch uses its own cost and price, else the product's.
 */

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

type Row = { name: string; units: number; cost: number; selling: number };

function stockValue() {
  const batches = loadBatches(initialBatches).filter((batch) => batch.stock > 0);
  const rows: Row[] = [];
  const missing: string[] = [];
  for (const product of getInventory()) {
    if (product.unregistered || product.id === undefined) continue;
    const productPrice = product.needsPrice ? null : Number(product.price.replace(/[₱,]/g, ''));
    const row: Row = { name: product.product, units: 0, cost: 0, selling: 0 };
    let incomplete = false;
    for (const batch of batches.filter((item) => item.productId === product.id)) {
      const cost = batch.unitCost ?? product.cost ?? null;
      const price = batch.sellingPrice ?? productPrice;
      if (cost === null || !price) {
        incomplete = true;
        continue;
      }
      row.units += batch.stock;
      row.cost += batch.stock * cost;
      row.selling += batch.stock * price;
    }
    // Loose pieces of an opened unit: sold at the piece price, each a share of the unit cost.
    const loose = product.loosePieces ?? 0;
    if (loose > 0 && product.piecesPerUnit) {
      if (product.cost && product.piecePrice) {
        row.cost += (loose * product.cost) / product.piecesPerUnit;
        row.selling += loose * product.piecePrice;
      } else {
        incomplete = true;
      }
    }
    if (incomplete) missing.push(product.product);
    if (row.cost || row.selling) rows.push(row);
  }
  rows.sort((a, b) => b.selling - a.selling);
  return { rows, missing };
}

export function StockValueReport() {
  const [data, setData] = useState<ReturnType<typeof stockValue> | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let current = true;
    // Fresh from the server, so the numbers include the latest sales and deliveries.
    syncAfterStockChange()
      .catch((error: unknown) => {
        if (current) setLoadError(error instanceof Error ? error.message : 'Could not load.');
      })
      .finally(() => current && setData(stockValue()));
    return () => {
      current = false;
    };
  }, []);

  if (!data) return <LoadingState label="Adding up the stock…" />;
  const cost = data.rows.reduce((sum, row) => sum + row.cost, 0);
  const selling = data.rows.reduce((sum, row) => sum + row.selling, 0);
  const profit = selling - cost;

  return (
    <>
      {loadError && (
        <ErrorState message={`${loadError} The numbers below are from the last time it loaded.`} />
      )}
      <section className={`profit-verdict${profit < 0 ? ' is-loss' : ''}`} aria-live="polite">
        <p>If all the stock on hand now is sold</p>
        <strong>
          {profit < 0 ? 'Loss' : 'Profit'} {money(Math.abs(profit))}
        </strong>
        <span>
          Selling value {money(selling)} − cost {money(cost)}
          {selling > 0 && ` · ${((profit / selling) * 100).toFixed(1)}% of the selling value`}
        </span>
      </section>

      <div className="cashier-summary-grid">
        <article className="cashier-summary-card">
          <p>Cost of the stock</p>
          <strong>{money(cost)}</strong>
          <span>What the stock on hand cost you</span>
        </article>
        <article className="cashier-summary-card">
          <p>Selling value</p>
          <strong>{money(selling)}</strong>
          <span>If every unit sells at its price</span>
        </article>
        <article className="cashier-summary-card">
          <p>Expected profit</p>
          <strong>{money(profit)}</strong>
          <span>Selling value minus cost</span>
        </article>
      </div>

      {data.missing.length > 0 && (
        <p className="pos-notice" role="status">
          Not counted: {data.missing.length} product{data.missing.length === 1 ? '' : 's'} with
          stock but no cost or no selling price yet ({data.missing.slice(0, 5).join(', ')}
          {data.missing.length > 5 ? ', …' : ''}). Set them under Products › Needs price / Needs
          cost so the totals are complete.
        </p>
      )}

      <h4 className="credit-section-title">Per product · highest selling value first</h4>
      <table className="stock-index__table">
        <thead>
          <tr>
            <th>Product</th>
            <th>On hand</th>
            <th>Cost</th>
            <th>Selling value</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.name}>
              <td>
                <strong>{row.name}</strong>
              </td>
              <td data-label="On hand">{row.units}</td>
              <td data-label="Cost">{money(row.cost)}</td>
              <td data-label="Selling value">{money(row.selling)}</td>
              <td data-label="Profit">{money(row.selling - row.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="register-empty">
        Worked out again each time you open this, from the stock on hand right now. Expired batches
        still on the shelf are counted too; take them out under Stock › Expiry check or Return
        stocks.
      </p>
    </>
  );
}
