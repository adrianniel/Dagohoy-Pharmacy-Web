import type { InventoryBatch } from './operationsStore';

/** The parts of a product the pricing needs (a Sales Counter item or a product list row). */
type InventoryProduct = {
  id?: number;
  barcode: string;
  price: string;
  unregistered?: boolean;
  /** Sold by piece: one price per piece, whatever the batch. */
  byPiece?: boolean;
};

/**
 * What a quantity of a product costs the customer, the way the server prices a sale: units
 * come from the batches that expire first (expired ones are never sold), and each batch sells
 * at its own price, or at the product's price when it has none. Keep in step with
 * SalesService.create on the server.
 */
export type PricePart = { quantity: number; price: number };

const toAmount = (price: string) => Number(price.replace(/[₱,]/g, '')) || 0;

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/** The product's sellable batches, in the order they leave the shelf. */
function sellableBatches(product: InventoryProduct, batches: InventoryBatch[]) {
  const day = today();
  return batches
    .filter(
      (batch) =>
        (product.id !== undefined && batch.productId !== undefined
          ? batch.productId === product.id
          : batch.barcode === product.barcode) &&
        batch.stock > 0 &&
        (!batch.expiry || batch.expiry >= day),
    )
    .sort((a, b) => {
      if (a.expiry && b.expiry && a.expiry !== b.expiry) return a.expiry.localeCompare(b.expiry);
      if (a.expiry && !b.expiry) return -1;
      if (!a.expiry && b.expiry) return 1;
      return Number(a.id) - Number(b.id);
    });
}

export function priceParts(
  product: InventoryProduct,
  quantity: number,
  batches: InventoryBatch[],
): PricePart[] {
  const base = toAmount(product.price);
  if (product.unregistered || product.byPiece) return [{ quantity, price: base }];
  const parts: PricePart[] = [];
  let left = quantity;
  for (const batch of sellableBatches(product, batches)) {
    if (left <= 0) break;
    const used = Math.min(batch.stock, left);
    const price = batch.sellingPrice ?? base;
    const last = parts[parts.length - 1];
    if (last && last.price === price) last.quantity += used;
    else parts.push({ quantity: used, price });
    left -= used;
  }
  // More than the batches on file (the counter refuses it anyway): show the product price.
  if (left > 0) parts.push({ quantity: left, price: base });
  return parts;
}

export const lineAmount = (
  product: InventoryProduct,
  quantity: number,
  batches: InventoryBatch[],
) =>
  priceParts(product, quantity, batches).reduce((sum, part) => sum + part.price * part.quantity, 0);

/** The price of the next unit sold: the first batch's, or the product's. */
export const nextUnitPrice = (product: InventoryProduct, batches: InventoryBatch[]) =>
  priceParts(product, 1, batches)[0]?.price ?? toAmount(product.price);
