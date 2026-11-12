import type { InventoryBatch } from './operationsStore';

/** Suggested order: bring the shelf back up to twice the reorder point. */
export const suggestedOrder = (stock: number, threshold: number) =>
  Math.max(threshold * 2 - stock, threshold);

/** The newest lot of a product that has the given field, newest received first. */
export function newestLot(
  batches: InventoryBatch[],
  barcode: string,
  has: (b: InventoryBatch) => boolean,
) {
  return batches
    .map((batch, index) => ({ batch, index }))
    .filter(({ batch }) => batch.barcode === barcode && has(batch))
    .sort(
      (a, b) =>
        (b.batch.receivedAt ?? '').localeCompare(a.batch.receivedAt ?? '') || b.index - a.index,
    )[0]?.batch;
}

/** Cost per unit of the newest lot of a product that has one recorded. */
export const lastLotCost = (batches: InventoryBatch[], barcode: string) =>
  newestLot(batches, barcode, (batch) => batch.unitCost !== undefined)?.unitCost;
