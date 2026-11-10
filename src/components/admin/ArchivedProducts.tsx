import { useEffect, useState } from 'react';
import { archiveProduct, listArchivedProducts, type ApiProduct } from '../../services/storeApi';
import { useToast } from '../toast';

/** Products that were archived (no longer sold). Restore puts one back on the list. */
export function ArchivedProducts({ onRestored }: { onRestored: () => Promise<void> }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<ApiProduct[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listArchivedProducts()
      .then(setProducts)
      .catch((caught: Error) => setError(caught.message));
  }, []);

  async function restore(product: ApiProduct) {
    try {
      await archiveProduct(product.id, false);
      setProducts((current) => (current ?? []).filter((item) => item.id !== product.id));
      await onRestored();
      showToast(`${product.name} is back on the product list.`, 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Could not restore it.', 'error');
    }
  }

  if (error) {
    return (
      <p className="pos-notice" role="alert">
        {error}
      </p>
    );
  }
  if (!products) return <p className="stock-index__empty">Loading archived products…</p>;
  if (!products.length) {
    return (
      <p className="stock-index__empty">No archived products. Archive one from its Edit form.</p>
    );
  }
  return (
    <div className="cashier-table-wrap" role="region" aria-label="Archived products" tabIndex={0}>
      <table className="cashier-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Barcode</th>
            <th>Last price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <strong>{product.name}</strong>
                <br />
                <small>{product.detail}</small>
              </td>
              <td className="cashier-mono">{product.barcode}</td>
              <td>₱{(product.price ?? 0).toFixed(2)}</td>
              <td>
                <button
                  className="cashier-view-button"
                  type="button"
                  onClick={() => void restore(product)}
                >
                  Restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
