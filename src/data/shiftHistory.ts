/*
 * Closed register shifts, kept so the next cashier can review the handover.
 * Only the most recent shift is shown to the cashier account; full income
 * reports stay with the owner and administrators.
 */

export type ShiftRecord = {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  openingFloat: number;
  salesCount: number;
  salesByPayment: Record<string, number>;
  cashSales: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  countedCash: number;
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

export function recordShift(shift: ShiftRecord) {
  const next = [shift, ...loadShiftHistory()].slice(0, SHIFT_HISTORY_LIMIT);
  localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(next));
}

export function getPreviousShift(): ShiftRecord | undefined {
  return loadShiftHistory()[0];
}
