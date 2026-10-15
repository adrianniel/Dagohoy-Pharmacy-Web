import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { mockProducts } from '../../data/cashierMockData';

export function CashierProductsPage() {
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
            <input type="search" placeholder="Search barcode, product, generic, or brand" />
          </label>
          <button className="cashier-filter-button" type="button">
            All stock statuses <span>⌄</span>
          </button>
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
              {mockProducts.map((product) => (
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
            </tbody>
          </table>
        </div>
        <div className="cashier-table-footer">
          <span>Showing {mockProducts.length} mock products</span>
          <span>Product maintenance is restricted to Admin.</span>
        </div>
      </section>
    </div>
  );
}
