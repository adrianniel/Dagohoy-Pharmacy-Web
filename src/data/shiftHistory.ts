/*
 * Closed register shifts, kept so the next cashier can review the handover.
 * Only the most recent shift is shown to the cashier account; full income
 * reports stay with the owner and administrators.
 */

export type ShiftRecord = {
  id: string;
  /** The first name on duty: what receipts and summaries show. */
  cashierName: string;
  /** Everyone who served the shift, for the full handover record. */
  onDutyNames?: string[];
  /** Present when the float carried over from the last shift was changed. */
  floatAdjustment?: { carriedOver: number; reason: string };
  openedAt: string;
  closedAt: string;
  openingFloat: number;
  salesCount: number;
  salesByPayment: Record<string, number>;
  cashSales: number;
  /** Utang cash taken during the shift. Missing on shifts closed before it was tracked. */
  creditCash?: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  countedCash: number;
  /** Why the counted cash did not match, written by the cashier at closing. */
  varianceNote?: string;
  /** Everything that happened in the shift, for the duty report. Missing on older shifts. */
  details?: ShiftDetails;
};

export type ShiftSaleRow = {
  receipt: string;
  date: string;
  payment: string;
  items: number;
  total: number;
  discount: number;
  status: string;
};

export type ShiftDetails = {
  /** Every sale made during the shift, voided ones included, newest first. */
  sales: ShiftSaleRow[];
  /** Cash in, cash out and utang payments recorded during the shift. */
  cashEvents: Array<{ type: string; amount: number; reason: string; date: string }>;
  /** Units and amount per product, voided sales left out, biggest first. */
  items: Array<{ product: string; quantity: number; amount: number }>;
  /** Amount taken per payment method, voided sales left out. */
  paymentTotals: Record<string, number>;
  grossSales: number;
  discounts: number;
  /** New unpaid utang created by credit sales in this shift. */
  newUtang: number;
  pendingGcash: number;
  voidedCount: number;
  voidedTotal: number;
  noChargeCount: number;
  noChargeValue: number;
};

const SHIFT_HISTORY_KEY = 'dagohoy_demo_shift_history';
const SHIFT_HISTORY_LIMIT = 60;

export function loadShiftHistory(): ShiftRecord[] {
  try {
    return JSON.parse(localStorage.getItem(SHIFT_HISTORY_KEY) ?? '[]') as ShiftRecord[];
  } catch {
    return [];
  }
}

/** Replaces the browser copy with the closed shifts from the server. */
export function saveShiftHistory(shifts: ShiftRecord[]) {
  localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(shifts.slice(0, SHIFT_HISTORY_LIMIT)));
}

export function getPreviousShift(): ShiftRecord | undefined {
  return loadShiftHistory()[0];
}

/** "5 hr 12 min" between two times. */
export function shiftDuration(from: string, to: string) {
  const minutes = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes % 60} min`;
}

/** Counted minus expected cash, and whether the drawer was balanced, short or over. */
export function shiftVariance(shift: ShiftRecord) {
  const variance = Math.round((shift.countedCash - shift.expectedCash) * 100) / 100;
  const label = Math.abs(variance) < 0.005 ? 'Balanced' : variance > 0 ? 'Over' : 'Short';
  return { variance, label } as const;
}
