import { useMemo, useState } from 'react';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { mockProducts } from '../../data/cashierMockData';

export function CashierProductsPage() {
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('All stock statuses');
  const products = useMemo(
    () =>
      mockProducts.filter((product) => {
        const matchesQuery = `${product.barcode} ${product.product} ${product.detail}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStock = stockFilter === 'All stock statuses' || product.status === stockFilter;
        return matchesQuery && matchesStock;
      }),
    [query, stockFilter],
  );
  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Read-only lookup"
        title="Products & Stock"
        description="Search current product details, selling prices, and available stock."
      />
      <section className="cashier-panel cashier-list-panel">
        <div className="cashier-list-toolbar">
          <label className="cashier-search-field cashier-search-field--wide">
            <CashierIcon name="search" />
            <input
              type="search"
              placeholder="Search barcode, product, generic, or brand"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="cashier-filter-button" aria-label="Filter products by stock status">
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option>All stock statuses</option>
              <option>In Stock</option>
              <option>Low Stock</option>
              <option>Out of Stock</option>
            </select>
          </label>
        </div>
        <div className="cashier-table-wrap">
          <table className="cashier-table cashier-products-table">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Product</th>
                <th>Generic / Brand</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Available Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.barcode}>
                  <td className="cashier-mono">{product.barcode}</td>
                  <td>
                    <strong>{product.product}</strong>
                  </td>
                  <td>{product.detail}</td>
                  <td>{product.unit}</td>
                  <td>
                    <strong>{product.price}</strong>
                  </td>
                  <td>{product.stock}</td>
                  <td>
                    <StatusBadge value={product.status} />
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7}>No products match your search or selected stock status.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="cashier-table-footer">
          <span>Showing {products.length} sample products</span>
          <span>Product maintenance is restricted to Admin.</span>
        </div>
      </section>
    </div>
  );
}
