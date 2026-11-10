import {
  closeShift,
  getCurrentShift,
  listShiftHistory,
  openShift,
  recordCashEvent,
} from '../services/shiftsApi';
import { getPreviousShift, saveShiftHistory, type ShiftDetails } from './shiftHistory';

/*
 * The register shift: who is on duty, the opening cash float and cash movements.
 * Starting a shift opens the store; ending it reconciles the drawer and saves the
 * handover for the next cashier. The server keeps the shift, the cash in/out and the
 * closed-shift reports; the browser keeps a copy that syncShift() refreshes.
 *
 * shortcut: utang payments stay in the browser until Phase 7, and the sales side of the
 * count until Phase 6; the browser sends those totals when the shift closes.
 */

export const REGISTER_SESSION_KEY = 'dagohoy_demo_register_session';
export const STORE_STATUS_CHANGE_EVENT = 'dagohoy-store-status-change';
const CASH_EVENTS_KEY = 'dagohoy_demo_cash_events';
const SALES_KEY = 'dagohoy_demo_sales';

export type RegisterSession = {
  /** Server id of the shift. */
  id?: string;
  openedAt: string;
  openingFloat: number;
  /** The first name picked when the shift opened: what receipts show. */
  cashierName: string;
  /** Everyone on duty for this shift, in the order the cashier picked them. */
  onDutyNames?: string[];
  /** Present when the cashier changed the float carried over from the last shift. */
  floatAdjustment?: { carriedOver: number; reason: string };
};

export type CashEvent = {
  id: string;
  /** "Utang payment" is cash a customer paid toward an open credit balance. */
  type: 'Paid in' | 'Paid out' | 'Utang payment';
  amount: number;
  reason: string;
  date: string;
  /** Shift the event belongs to (kept on browser-only utang payments). */
  shiftId?: string;
};

type Sale = {
  payment: string;
  total: number;
  date: string;
  status?: string;
  /** Cash a credit customer paid at the counter when the sale was made. */
  downPayment?: number;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function notifyStoreStatusChange(): void {
  window.dispatchEvent(new Event(STORE_STATUS_CHANGE_EVENT));
}

export function getSession(): RegisterSession | null {
  return readJson<RegisterSession | null>(REGISTER_SESSION_KEY, null);
}

export function isStoreOpen(): boolean {
  return Boolean(getSession());
}

export function getCashEvents(): CashEvent[] {
  return readJson<CashEvent[]>(CASH_EVENTS_KEY, []);
}

/** Cash in/out is saved on the server; an utang payment stays in the browser for now. */
export async function addCashEvent(event: CashEvent) {
  if (event.type === 'Utang payment') {
    const local = { ...event, shiftId: getSession()?.id };
    localStorage.setItem(CASH_EVENTS_KEY, JSON.stringify([local, ...getCashEvents()]));
    notifyStoreStatusChange();
    return;
  }
  await recordCashEvent({
    type: event.type === 'Paid in' ? 'paid_in' : 'paid_out',
    amount: event.amount,
    reason: event.reason,
  });
  await syncShift();
}

/**
 * Copies the open shift, its cash in/out and the closed-shift reports from the server.
 * Browser-only utang payments of the same shift are kept.
 */
export async function syncShift() {
  const [current, history] = await Promise.all([getCurrentShift(), listShiftHistory()]);
  saveShiftHistory(history);
  const shift = current.shift;
  if (!shift) {
    localStorage.removeItem(REGISTER_SESSION_KEY);
    localStorage.removeItem(CASH_EVENTS_KEY);
  } else {
    const id = String(shift.id);
    const session: RegisterSession = {
      id,
      openedAt: shift.openedAt,
      openingFloat: shift.openingFloat,
      cashierName: shift.cashierName,
      onDutyNames: shift.onDutyNames,
      floatAdjustment: shift.floatAdjustment,
    };
    const utang = getCashEvents().filter(
      (event) => event.type === 'Utang payment' && event.shiftId === id,
    );
    localStorage.setItem(REGISTER_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(
      CASH_EVENTS_KEY,
      JSON.stringify(
        [...current.cashEvents.map((event) => ({ ...event, id: String(event.id) })), ...utang].sort(
          (a, b) => b.date.localeCompare(a.date),
        ),
      ),
    );
  }
  notifyStoreStatusChange();
}

/** Cash left in the drawer at the end of the previous shift. */
export function getCarriedOverFloat(): number {
  return getPreviousShift()?.countedCash ?? 0;
}

export type ShiftTotals = {
  cashSales: number;
  /** Utang cash: down payments on credit sales plus payments on old balances. */
  creditCash: number;
  paidIn: number;
  paidOut: number;
  expected: number;
};

export function getShiftTotals(session = getSession(), until = new Date()): ShiftTotals {
  if (!session) return { cashSales: 0, creditCash: 0, paidIn: 0, paidOut: 0, expected: 0 };
  const opened = new Date(session.openedAt);
  const shiftSales = readJson<Sale[]>(SALES_KEY, []).filter((sale) => {
    const date = new Date(sale.date);
    return sale.status !== 'Voided' && date >= opened && date <= until;
  });
  const cashSales = shiftSales
    .filter((sale) => sale.payment === 'Cash')
    .reduce((sum, sale) => sum + sale.total, 0);
  const downPayments = shiftSales
    .filter((sale) => sale.payment === 'Credit')
    .reduce((sum, sale) => sum + Number(sale.downPayment ?? 0), 0);
  const events = getCashEvents();
  const utangPayments = events
    .filter((event) => event.type === 'Utang payment')
    .reduce((sum, event) => sum + event.amount, 0);
  const creditCash = downPayments + utangPayments;
  const paidIn = events
    .filter((event) => event.type === 'Paid in')
    .reduce((sum, event) => sum + event.amount, 0);
  const paidOut = events
    .filter((event) => event.type === 'Paid out')
    .reduce((sum, event) => sum + event.amount, 0);
  return {
    cashSales,
    creditCash,
    paidIn,
    paidOut,
    expected: session.openingFloat + cashSales + creditCash + paidIn - paidOut,
  };
}

/** Opens the shift on the server (it refuses a second open shift). */
export async function startShift(input: {
  onDutyNames: string[];
  openingFloat: number;
  adjustmentReason?: string;
}): Promise<RegisterSession> {
  const onDutyNames = input.onDutyNames.map((name) => name.trim()).filter(Boolean);
  if (!onDutyNames.length) {
    throw new Error('Select at least one name who is on duty.');
  }
  await openShift({
    onDutyNames,
    openingFloat: input.openingFloat,
    adjustmentReason: input.adjustmentReason?.trim() || undefined,
  });
  await syncShift();
  const session = getSession();
  if (!session) throw new Error('The shift did not open. Try again.');
  return session;
}

type StoredSale = {
  receipt: string;
  date: string;
  payment: string;
  total?: number;
  subtotal?: number;
  discount?: number;
  items?: number;
  status?: string;
  creditBalance?: number;
  paymentStatus?: string;
  lines?: Array<{ product: string; quantity: number; unitPrice: number }>;
};

/** Collects every sale, item and cash movement of a shift for its duty report. */
export function collectShiftDetails(
  opened: Date,
  closedAt: Date,
  cashEvents: CashEvent[] = getCashEvents(),
): ShiftDetails {
  const sales = readJson<StoredSale[]>(SALES_KEY, []).filter((sale) => {
    const date = new Date(sale.date);
    return date >= opened && date <= closedAt;
  });
  const kept = sales.filter((sale) => sale.status !== 'Voided');
  const charged = kept.filter((sale) => sale.payment !== 'No charge');
  const voided = sales.filter((sale) => sale.status === 'Voided');
  const noCharge = kept.filter((sale) => sale.payment === 'No charge');

  const items = new Map<string, { product: string; quantity: number; amount: number }>();
  for (const sale of charged) {
    for (const line of sale.lines ?? []) {
      const row = items.get(line.product) ?? { product: line.product, quantity: 0, amount: 0 };
      row.quantity += line.quantity;
      row.amount += line.quantity * line.unitPrice;
      items.set(line.product, row);
    }
  }
  const paymentTotals = charged.reduce<Record<string, number>>((totals, sale) => {
    totals[sale.payment] = (totals[sale.payment] ?? 0) + Number(sale.total ?? 0);
    return totals;
  }, {});

  return {
    sales: sales.map((sale) => ({
      receipt: sale.receipt,
      date: sale.date,
      payment: sale.payment,
      items: Number(sale.items ?? 0),
      total: Number(sale.total ?? 0),
      discount: Number(sale.discount ?? 0),
      status: sale.status ?? 'Completed',
    })),
    cashEvents: cashEvents.map(({ type, amount, reason, date }) => ({
      type,
      amount,
      reason,
      date,
    })),
    items: [...items.values()].sort((a, b) => b.amount - a.amount),
    paymentTotals,
    grossSales: charged.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
    discounts: charged.reduce((sum, sale) => sum + Number(sale.discount ?? 0), 0),
    newUtang: charged
      .filter((sale) => sale.payment === 'Credit')
      .reduce((sum, sale) => sum + Number(sale.creditBalance ?? 0), 0),
    pendingGcash: charged.filter(
      (sale) => sale.payment === 'GCash' && sale.paymentStatus !== 'Paid',
    ).length,
    voidedCount: voided.length,
    voidedTotal: voided.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
    noChargeCount: noCharge.length,
    noChargeValue: noCharge.reduce((sum, sale) => sum + Number(sale.subtotal ?? 0), 0),
  };
}

/**
 * Counts the drawer and closes the shift. The note explains a short or over count.
 * Returns the saved shift record, so the duty report can be shown right away.
 */
export async function endShift(countedCash: number, varianceNote?: string) {
  const session = getSession();
  if (!session) return;
  const closedAt = new Date();
  const totals = getShiftTotals(session, closedAt);
  const shiftSales = readJson<Sale[]>(SALES_KEY, []).filter((sale) => {
    const date = new Date(sale.date);
    return sale.status !== 'Voided' && date >= new Date(session.openedAt) && date <= closedAt;
  });
  const salesByPayment = shiftSales.reduce<Record<string, number>>((counts, sale) => {
    counts[sale.payment] = (counts[sale.payment] ?? 0) + 1;
    return counts;
  }, {});
  // The server adds the paid in/out it recorded and checks the count against it.
  const record = await closeShift({
    countedCash,
    varianceNote: varianceNote?.trim() || undefined,
    cashSales: totals.cashSales,
    creditCash: totals.creditCash,
    salesCount: shiftSales.length,
    salesByPayment,
    details: collectShiftDetails(new Date(session.openedAt), closedAt),
  });
  await syncShift();
  return {
    ...totals,
    expected: record.expectedCash,
    countedCash,
    variance: countedCash - record.expectedCash,
    record,
  };
}
