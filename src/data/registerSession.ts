import { getPreviousShift, recordShift, type ShiftDetails, type ShiftRecord } from './shiftHistory';

/*
 * The register shift: who is on duty, the opening cash float and cash movements.
 * Starting a shift opens the store; ending it reconciles the drawer and saves the
 * handover for the next cashier. Stored in the browser for the design phase.
 */

export const REGISTER_SESSION_KEY = 'dagohoy_demo_register_session';
export const STORE_STATUS_CHANGE_EVENT = 'dagohoy-store-status-change';
const CASH_EVENTS_KEY = 'dagohoy_demo_cash_events';
const SALES_KEY = 'dagohoy_demo_sales';

export type RegisterSession = {
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

export function addCashEvent(event: CashEvent) {
  localStorage.setItem(CASH_EVENTS_KEY, JSON.stringify([event, ...getCashEvents()]));
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

export function startShift(input: {
  onDutyNames: string[];
  openingFloat: number;
  adjustmentReason?: string;
}): RegisterSession {
  const onDutyNames = input.onDutyNames.map((name) => name.trim()).filter(Boolean);
  if (!onDutyNames.length) {
    throw new Error('Select at least one name who is on duty.');
  }
  const carriedOver = getCarriedOverFloat();
  const adjusted = Math.abs(input.openingFloat - carriedOver) >= 0.005;
  if (adjusted && !input.adjustmentReason?.trim()) {
    throw new Error('Enter a reason for changing the cash float.');
  }
  const session: RegisterSession = {
    openedAt: new Date().toISOString(),
    openingFloat: input.openingFloat,
    cashierName: onDutyNames[0],
    onDutyNames,
    floatAdjustment: adjusted ? { carriedOver, reason: input.adjustmentReason!.trim() } : undefined,
  };
  localStorage.setItem(REGISTER_SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(CASH_EVENTS_KEY);
  notifyStoreStatusChange();
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
function collectShiftDetails(opened: Date, closedAt: Date): ShiftDetails {
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
    cashEvents: getCashEvents().map(({ type, amount, reason, date }) => ({
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
export function endShift(countedCash: number, varianceNote?: string) {
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
  const record: ShiftRecord = {
    id: crypto.randomUUID(),
    cashierName: session.cashierName,
    onDutyNames: session.onDutyNames ?? [session.cashierName],
    openedAt: session.openedAt,
    closedAt: closedAt.toISOString(),
    openingFloat: session.openingFloat,
    floatAdjustment: session.floatAdjustment,
    salesCount: shiftSales.length,
    salesByPayment,
    cashSales: totals.cashSales,
    creditCash: totals.creditCash,
    paidIn: totals.paidIn,
    paidOut: totals.paidOut,
    expectedCash: totals.expected,
    countedCash,
    varianceNote: varianceNote?.trim() || undefined,
    details: collectShiftDetails(new Date(session.openedAt), closedAt),
  };
  recordShift(record);
  localStorage.removeItem(REGISTER_SESSION_KEY);
  localStorage.removeItem(CASH_EVENTS_KEY);
  notifyStoreStatusChange();
  return { ...totals, countedCash, variance: countedCash - totals.expected, record };
}
