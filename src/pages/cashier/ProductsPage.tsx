import { useEffect, useMemo, useState } from 'react';
import { BarcodeScannerInput } from '../../components/BarcodeScannerInput';
import { CashierIcon } from '../../components/cashier/CashierIcon';
import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { useToast } from '../../components/toast';
import {
  getInventory,
  InventoryProduct,
  saveInventory,
  stockStatus,
} from '../../data/inventoryStore';
import { loadBatches, loadMovements, saveBatches, saveMovements } from '../../data/operationsStore';
import { lookupProductByBarcode, suggestProductCategories } from '../../services/productsApi';

const formatPrice = (value: number | null) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value ?? 0);

export function CashierProductsPage() {
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('All stock statuses');
  const [catalog, setCatalog] = useState(getInventory);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [receivedQuantity, setReceivedQuantity] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [categoryStatus, setCategoryStatus] = useState('Checking product categories…');
  const { showToast } = useToast();

  useEffect(() => {
    const uncategorized = getInventory().filter((product) => !product.category?.trim());
    if (uncategorized.length === 0) {
      setCategoryStatus('Categories organized');
      return;
    }
    let active = true;
    setIsOrganizing(true);
    void suggestProductCategories(
      uncategorized.map((product) => ({
        id: product.barcode,
        name: product.product,
        detail: product.detail,
      })),
    )
      .then((suggestions) => {
        if (!active) return;
        const categories = new Map(suggestions.map(({ id, category }) => [id, category]));
        const organized = getInventory().map((product) => ({
          ...product,
          category: categories.get(product.barcode) ?? product.category,
        }));
        setCatalog(organized);
        saveInventory(organized);
        setCategoryStatus('Categories organized');
        showToast('Product categories were organized. Review labels if needed.', 'info');
      })
      .catch(() => {
        // The inventory remains usable if the optional AI service is unavailable.
        if (active)
          setCategoryStatus('AI suggestions unavailable · uncategorized items remain visible');
      })
      .finally(() => {
        if (active) setIsOrganizing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const products = useMemo(
    () =>
      catalog.filter((product) => {
        const matchesQuery =
          `${product.barcode} ${product.product} ${product.detail} ${product.category ?? ''}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesStock = stockFilter === 'All stock statuses' || product.status === stockFilter;
        return matchesQuery && matchesStock;
      }),
    [catalog, query, stockFilter],
  );
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, InventoryProduct[]>();
    products.forEach((product) => {
      const category = product.category?.trim() || 'Uncategorized';
      groups.set(category, [...(groups.get(category) ?? []), product]);
    });
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [products]);

  function selectProductForReceiving(product: InventoryProduct) {
    setSelectedProduct(product);
    setReceivedQuantity('1');
    setExpiryDate('');
    showToast(`${product.product} selected for stock receiving.`, 'info');
  }

  async function selectScannedProduct(barcode: string) {
    let product = catalog.find((item) => item.barcode === barcode);
    try {
      const result = await lookupProductByBarcode(barcode);
      if (result.found) {
        const details = [result.product.genericName, result.product.brand, result.product.strength]
          .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
          .join(' · ');
        const known = getInventory().find((item) => item.barcode === barcode);
        product = {
          ...(known ?? {
            barcode: result.product.barcode,
            product: result.product.name,
            detail: details || result.product.dosageForm || 'Product details from pharmacy catalog',
            unit: result.product.productUnit?.name ?? 'Unconfigured unit',
            price: formatPrice(result.product.sellingPrice),
            stock: 0,
            status: stockStatus(0),
          }),
          product: result.product.name,
          detail:
            details ||
            known?.detail ||
            result.product.dosageForm ||
            'Product details from pharmacy catalog',
          unit: result.product.productUnit?.name ?? known?.unit ?? 'Unconfigured unit',
          price:
            result.product.sellingPrice === null
              ? (known?.price ?? formatPrice(null))
              : formatPrice(result.product.sellingPrice),
        };
        const inventory = getInventory();
        const next = known
          ? inventory.map((item) => (item.barcode === barcode ? product! : item))
          : [...inventory, product];
        saveInventory(next);
        setCatalog(next);
      }
    } catch {
      // Keep receiving available for locally saved products when the server is offline.
    }
    if (!product) {
      showToast(
        `Barcode ${barcode} is not in the catalog. Ask an owner to encode the product first.`,
        'error',
      );
      return;
    }
    selectProductForReceiving(product);
  }

  function receiveStock() {
    if (!selectedProduct) return;
    const quantity = Number(receivedQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      showToast('Enter a whole-number quantity greater than zero.', 'error');
      return;
    }
    if (!expiryDate || expiryDate < new Date().toISOString().slice(0, 10)) {
      showToast('Enter a valid future expiration date for this batch.', 'error');
      return;
    }
    const receivedAt = new Date().toISOString();
    const batchId = `B-${receivedAt.replace(/\D/g, '').slice(0, 14)}`;
    const current = getInventory();
    const next = current.map((product) =>
      product.barcode === selectedProduct.barcode
        ? {
            ...product,
            stock: product.stock + quantity,
            status: stockStatus(product.stock + quantity),
          }
        : product,
    );
    saveInventory(next);
    const batches = loadBatches([]);
    batches.unshift({
      id: batchId,
      product: selectedProduct.product,
      barcode: selectedProduct.barcode,
      lot: batchId,
      expiry: expiryDate,
      stock: quantity,
      receivedAt,
    });
    saveBatches(batches);
    const receivedProduct = next.find((product) => product.barcode === selectedProduct.barcode)!;
    setCatalog(next);
    setSelectedProduct(null);
    const movements = loadMovements();
    movements.unshift({
      id: `RCV-${receivedAt.replace(/\D/g, '').slice(0, 14)}`,
      date: receivedAt,
      product: receivedProduct.product,
      kind: 'Received',
      change: quantity,
      reference: batchId,
      staff: 'Cashier',
      reason: `Stock received by barcode scan · expires ${expiryDate}`,
    });
    saveMovements(movements);
    showToast(
      `${quantity} ${receivedProduct.unit.toLowerCase()}${quantity === 1 ? '' : 's'} received for ${receivedProduct.product} · batch ${batchId}.`,
    );
  }

  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Products & stock · cashier"
        title="Products & Stock"
        description="Receive incoming supply with a barcode scan and browse stock organized by category."
      />
      <section className="cashier-panel product-receiving-panel">
        <div className="cashier-panel__heading">
          <div>
            <h3>Receive stock</h3>
            <p>
              Scan a barcode for fast lookup, or select a product manually. Details fill in
              automatically when the barcode is recognized.
            </p>
          </div>
          <span className="product-ai-status">
            {isOrganizing ? 'Organizing categories…' : categoryStatus}
          </span>
        </div>
        <BarcodeScannerInput
          onScan={selectScannedProduct}
          placeholder="Scan supplied product barcode…"
        />
        <div className="product-manual-select">
          <label htmlFor="manual-receive-product">Or select a product manually</label>
          <select
            id="manual-receive-product"
            value={selectedProduct?.barcode ?? ''}
            onChange={(event) => {
              const product = catalog.find((item) => item.barcode === event.target.value);
              if (product) selectProductForReceiving(product);
            }}
          >
            <option value="">Choose a product…</option>
            {catalog.map((product) => (
              <option value={product.barcode} key={product.barcode}>
                {product.product} · {product.barcode}
              </option>
            ))}
          </select>
        </div>
        {selectedProduct && (
          <div className="product-receive-confirm">
            <div>
              <strong>{selectedProduct.product}</strong>
              <span>
                Barcode {selectedProduct.barcode} · {selectedProduct.category ?? 'Uncategorized'}
              </span>
              <span>
                {selectedProduct.detail} · {selectedProduct.unit} · {selectedProduct.price} ·
                Current stock {selectedProduct.stock}
              </span>
            </div>
            <label>
              Received quantity
              <input
                type="number"
                min="1"
                step="1"
                value={receivedQuantity}
                onChange={(event) => setReceivedQuantity(event.target.value)}
              />
            </label>
            <label>
              Expiration date
              <input
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </label>
            <span className="product-batch-date-note">
              Batch date: recorded automatically when stock receipt is confirmed.
            </span>
            <button className="cashier-primary-action" type="button" onClick={receiveStock}>
              Confirm received stock
            </button>
            <button
              className="cashier-view-button"
              type="button"
              onClick={() => setSelectedProduct(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
      <section className="cashier-panel cashier-list-panel">
        <div className="cashier-list-toolbar">
          <label className="cashier-search-field cashier-search-field--wide">
            <CashierIcon name="search" />
            <input
              type="search"
              placeholder="Search barcode, product, or category"
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
        {groupedProducts.length === 0 ? (
          <p className="product-empty-state">
            No products match your search or selected stock status.
          </p>
        ) : (
          groupedProducts.map(([category, categoryProducts]) => (
            <section className="product-category-group" key={category}>
              <h3>
                {category}
                <span>{categoryProducts.length}</span>
              </h3>
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
                    {categoryProducts.map((product) => (
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
            </section>
          ))
        )}
        <div className="cashier-table-footer">
          <span>Showing {products.length} catalog products</span>
          <span>Stock receipts are saved in this browser demo.</span>
        </div>
      </section>
    </div>
  );
}
