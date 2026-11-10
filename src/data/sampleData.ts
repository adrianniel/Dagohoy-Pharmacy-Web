/*
 * DEV ONLY. Fills the browser with sample records so every page has something to show:
 * products, delivered lots, 45 days of sales (cash, GCash, utang, voids, no-charge),
 * closed shifts with duty reports, today's open shift, expenses and suppliers.
 *
 * Everything is simulated in order, the same way the real pages save it, so stock,
 * lots, movements, shifts and reports all add up. A fixed random seed gives the same
 * data every time. Loaded from Settings → Start fresh (only shown in `npm run dev`).
 */
import {
  addStaff,
  createProduct,
  createSupplier,
  listProducts,
  listStaff,
  listSuppliers,
} from '../services/storeApi';
import { getInventory, type InventoryProduct } from './inventoryStore';
import type { InventoryBatch, StockMovement } from './operationsStore';
import { collectShiftDetails, type CashEvent, type RegisterSession } from './registerSession';
import type { ShiftRecord } from './shiftHistory';
import type { RosterStaff } from './staffRoster';
import { syncFromServer } from './serverSync';

const DAYS = 45;
const FLOAT = 1000;

type Seed = {
  barcode: string;
  product: string;
  detail: string;
  unit: string;
  price: number;
  cost: number;
  category: string;
  supplier: string;
  /** Pieces in the first delivery. */
  stock: number;
  /** How often it sells (relative). */
  weight: number;
  /** Most pieces one customer buys. */
  maxQty: number;
  /** Days from the first delivery to the lot's expiry. */
  shelfDays: number;
};

const SUPPLIERS = [
  { name: 'Zuellig Pharma', contact: '0917 555 0101' },
  { name: 'Metro Drug Inc.', contact: '0918 555 0144' },
  { name: 'Unilab Direct', contact: '(082) 555 0190' },
  { name: 'Davao Medical Supply', contact: '0920 555 0123' },
];

const PRODUCTS: Seed[] = [
  [
    '4800016642012',
    'Biogesic 500mg',
    'Paracetamol / Unilab',
    'Tablet',
    5.5,
    3.6,
    'Pain & Fever',
    'Unilab Direct',
    400,
    10,
    10,
    600,
  ],
  [
    '4806516731010',
    'Neozep Forte',
    'Phenylephrine + Chlorphenamine / Unilab',
    'Tablet',
    8.75,
    5.9,
    'Cough & Colds',
    'Unilab Direct',
    300,
    8,
    10,
    540,
  ],
  [
    '4800016640018',
    'Bioflu',
    'Phenylephrine + Paracetamol / Unilab',
    'Tablet',
    9.25,
    6.2,
    'Cough & Colds',
    'Unilab Direct',
    250,
    6,
    10,
    500,
  ],
  [
    '4800016655012',
    'Solmux 500mg',
    'Carbocisteine / Unilab',
    'Capsule',
    11.5,
    7.8,
    'Cough & Colds',
    'Unilab Direct',
    200,
    5,
    10,
    480,
  ],
  [
    '4800361412018',
    'Medicol Advance 400',
    'Ibuprofen / Unilab',
    'Capsule',
    8.0,
    5.1,
    'Pain & Fever',
    'Unilab Direct',
    200,
    5,
    8,
    520,
  ],
  [
    '4800016610011',
    'Alaxan FR',
    'Ibuprofen + Paracetamol / Unilab',
    'Capsule',
    9.5,
    6.4,
    'Pain & Fever',
    'Unilab Direct',
    200,
    5,
    8,
    520,
  ],
  [
    '4800361380017',
    'Decolgen Forte',
    'Phenylpropanolamine / Unilab',
    'Tablet',
    7.25,
    4.8,
    'Cough & Colds',
    'Unilab Direct',
    150,
    3,
    10,
    30,
  ],
  [
    '4806501720013',
    'Amoxicillin 500mg',
    'Amoxicillin / RiteMed',
    'Capsule',
    6.5,
    3.9,
    'Antibiotics',
    'Metro Drug Inc.',
    300,
    4,
    21,
    400,
  ],
  [
    '4806501720501',
    'Cefalexin 500mg',
    'Cefalexin / RiteMed',
    'Capsule',
    12.0,
    7.5,
    'Antibiotics',
    'Metro Drug Inc.',
    150,
    1,
    14,
    400,
  ],
  [
    '4806501731002',
    'Losartan 50mg',
    'Losartan / RiteMed',
    'Tablet',
    9.0,
    5.2,
    'Maintenance',
    'Metro Drug Inc.',
    300,
    4,
    30,
    700,
  ],
  [
    '4806501731019',
    'Amlodipine 5mg',
    'Amlodipine / RiteMed',
    'Tablet',
    6.0,
    3.4,
    'Maintenance',
    'Metro Drug Inc.',
    300,
    4,
    30,
    700,
  ],
  [
    '4806501731026',
    'Metformin 500mg',
    'Metformin / RiteMed',
    'Tablet',
    4.5,
    2.5,
    'Maintenance',
    'Metro Drug Inc.',
    300,
    3,
    30,
    700,
  ],
  [
    '4806501740011',
    'Cetirizine 10mg',
    'Cetirizine / RiteMed',
    'Tablet',
    7.5,
    4.3,
    'Allergy',
    'Zuellig Pharma',
    160,
    3,
    10,
    600,
  ],
  [
    '4806501740028',
    'Loperamide 2mg',
    'Loperamide / RiteMed',
    'Capsule',
    6.25,
    3.5,
    'Stomach',
    'Zuellig Pharma',
    100,
    1,
    6,
    25,
  ],
  [
    '4806501740035',
    'Omeprazole 20mg',
    'Omeprazole / RiteMed',
    'Capsule',
    10.0,
    6.0,
    'Stomach',
    'Zuellig Pharma',
    140,
    1,
    7,
    -5,
  ],
  [
    '4800361322017',
    'Kremil-S',
    'Aluminum Hydroxide / Unilab',
    'Tablet',
    8.5,
    5.6,
    'Stomach',
    'Unilab Direct',
    150,
    3,
    6,
    480,
  ],
  [
    '4800016600012',
    'Enervon C',
    'Multivitamins / Unilab',
    'Tablet',
    7.0,
    4.6,
    'Vitamins',
    'Unilab Direct',
    200,
    4,
    30,
    650,
  ],
  [
    '4806501750010',
    'Ascorbic Acid 500mg',
    'Vitamin C / RiteMed',
    'Tablet',
    3.5,
    1.9,
    'Vitamins',
    'Zuellig Pharma',
    500,
    5,
    20,
    650,
  ],
  [
    '4800888140016',
    'Tempra Syrup 60ml',
    'Paracetamol / Taisho',
    'Bottle',
    98.0,
    72.0,
    'Kids',
    'Davao Medical Supply',
    30,
    2,
    1,
    500,
  ],
  [
    '4800888150015',
    'Ceelin Syrup 120ml',
    'Vitamin C / Taisho',
    'Bottle',
    145.0,
    108.0,
    'Kids',
    'Davao Medical Supply',
    25,
    1,
    1,
    500,
  ],
  [
    '4800888160014',
    'Betadine 60ml',
    'Povidone-Iodine / Mundipharma',
    'Bottle',
    165.0,
    120.0,
    'First Aid',
    'Davao Medical Supply',
    15,
    1,
    1,
    900,
  ],
  [
    '4800888170013',
    'Band-Aid Strips (10s)',
    'Adhesive bandage / J&J',
    'Pack',
    45.0,
    30.0,
    'First Aid',
    'Davao Medical Supply',
    40,
    1,
    2,
    1200,
  ],
  [
    '4800888180012',
    'Face Mask (box of 50)',
    'Surgical mask / Indoplas',
    'Box',
    120.0,
    80.0,
    'First Aid',
    'Davao Medical Supply',
    12,
    1,
    1,
    1200,
  ],
].map(
  ([
    barcode,
    product,
    detail,
    unit,
    price,
    cost,
    category,
    supplier,
    stock,
    weight,
    maxQty,
    shelfDays,
  ]) =>
    ({
      barcode,
      product,
      detail,
      unit,
      price,
      cost,
      category,
      supplier,
      stock,
      weight,
      maxQty,
      shelfDays,
    }) as Seed,
);

/** Never restocked, so the low-stock alerts have something to show. */
const LEFT_LOW = ['Decolgen Forte', 'Cefalexin 500mg', 'Betadine 60ml', 'Face Mask (box of 50)'];

const STAFF = ['Maria Santos', 'Ana Reyes', 'Jose Cruz'];
const CREDIT_CUSTOMERS = [
  'Aling Nena Dizon',
  'Mang Tonyo Garcia',
  'Lorna Villanueva',
  'Ramil Bautista',
];
const VOID_REASONS = ['Wrong item', 'Wrong quantity', 'Wrong price', 'Customer cancelled'];

/** Small seeded random generator, so the sample data is the same every time. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
const peso = (value: number) => `₱${value.toFixed(2)}`;
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Midnight `offset` days from today (negative = past). */
function day(offset: number, hour = 0, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

type Line = { product: string; barcode: string; quantity: number; unitPrice: number };
type Sale = Record<string, unknown> & {
  receipt: string;
  date: string;
  total: number;
  payment: string;
  status: string;
  lines: Line[];
};

export function loadSampleData() {
  const rand = random(20261109);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const now = new Date();

  const inventory = new Map<string, InventoryProduct & { _seed: Seed }>();
  const batches: InventoryBatch[] = [];
  const movements: StockMovement[] = [];
  const sales: Sale[] = [];
  const voidLog: Array<{
    receipt: string;
    date: string;
    reason: string;
    cashier: string;
    total: number;
  }> = [];
  const shifts: ShiftRecord[] = [];
  let receiptNo = 100230;
  let idNo = 1;
  const nextId = (prefix: string) => `${prefix}-${String(idNo++).padStart(5, '0')}`;

  function receive(seed: Seed, qty: number, when: Date, shelfDays: number, lot: string) {
    const expiry = new Date(when);
    expiry.setDate(expiry.getDate() + shelfDays);
    const unitCost = seed.cost;
    batches.push({
      id: nextId('B'),
      product: seed.product,
      barcode: seed.barcode,
      lot,
      expiry: isoDay(expiry),
      stock: qty,
      receivedAt: when.toISOString(),
      unitCost,
      supplier: seed.supplier,
    });
    movements.push({
      id: nextId('RCV'),
      date: when.toISOString(),
      product: seed.product,
      kind: 'Received',
      change: qty,
      reference: `DR-${String(4100 + idNo)}`,
      staff: 'Jeanette Boncales',
      reason: `${seed.supplier} · lot ${lot} · ${peso(unitCost)}/unit · expires ${expiry.toLocaleDateString('en-PH', { dateStyle: 'medium' })}`,
      unitCost,
    });
    const item = inventory.get(seed.barcode)!;
    item.stock += qty;
  }

  /** Takes pieces from the lot that expires first (FEFO); false if not enough stock. */
  function take(barcode: string, qty: number, when: Date) {
    const lots = batches
      .filter(
        (batch) =>
          batch.barcode === barcode &&
          batch.stock > 0 &&
          new Date(`${batch.expiry}T23:59:59`) >= when,
      )
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
    if (lots.reduce((sum, lot) => sum + lot.stock, 0) < qty) return false;
    let left = qty;
    for (const lot of lots) {
      const used = Math.min(lot.stock, left);
      lot.stock -= used;
      left -= used;
      if (!left) break;
    }
    inventory.get(barcode)!.stock -= qty;
    return true;
  }

  // 1. Products and the first delivery, 50 days ago.
  for (const seed of PRODUCTS) {
    inventory.set(seed.barcode, {
      barcode: seed.barcode,
      product: seed.product,
      detail: seed.detail,
      unit: seed.unit,
      price: peso(seed.price),
      stock: 0,
      status: 'Out of Stock',
      category: seed.category,
      cost: seed.cost,
      _seed: seed,
    });
    // shelfDays counts from today, so the expiry alerts land where intended.
    receive(seed, seed.stock, day(-50, 9), seed.shelfDays + 50, `L${seed.barcode.slice(-4)}A`);
  }

  // 2. Days of trading. Restock popular items 20 days ago.
  const weighted = PRODUCTS.flatMap((seed) => Array<Seed>(seed.weight).fill(seed));
  let float = FLOAT;
  const openCredits: Sale[] = [];

  for (let offset = -DAYS; offset <= 0; offset += 1) {
    // Restocks: everything except the few items left low on purpose.
    const restock = offset === -32 ? 'B' : offset === -14 ? 'C' : '';
    if (restock) {
      for (const seed of PRODUCTS.filter((item) => !LEFT_LOW.includes(item.product))) {
        receive(
          seed,
          seed.stock,
          day(offset, 8, 30),
          seed.shelfDays + 380,
          `L${seed.barcode.slice(-4)}${restock}`,
        );
      }
    }
    const today = offset === 0;
    const opened = day(offset, 8, 0);
    if (today && now < opened) break;
    const closes = today ? now : day(offset, 20, 0);
    const cashier = STAFF[(offset + DAYS) % STAFF.length];
    const helper = rand() < 0.4 ? STAFF[(offset + DAYS + 1) % STAFF.length] : undefined;
    const onDuty = helper ? [cashier, helper] : [cashier];
    const events: CashEvent[] = [];
    const shiftSales: Sale[] = [];

    const count = Math.round(
      ((closes.getTime() - opened.getTime()) / 43200000) * (10 + rand() * 12),
    );
    const times = Array.from(
      { length: count },
      () => opened.getTime() + 300000 + rand() * (closes.getTime() - opened.getTime() - 600000),
    ).sort();

    for (const time of times) {
      const when = new Date(time);
      const lines: Line[] = [];
      const lineCount = rand() < 0.6 ? 1 : rand() < 0.75 ? 2 : 3;
      for (let i = 0; i < lineCount; i += 1) {
        const seed = pick(weighted);
        if (lines.some((line) => line.barcode === seed.barcode)) continue;
        const qty = 1 + Math.floor(rand() * seed.maxQty);
        if (!take(seed.barcode, qty, when)) continue;
        lines.push({
          product: seed.product,
          barcode: seed.barcode,
          quantity: qty,
          unitPrice: seed.price,
        });
      }
      if (!lines.length) continue;

      const receipt = `DP-${receiptNo++}`;
      const subtotal = round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
      const roll = rand();
      const base = {
        receipt,
        date: when.toISOString(),
        items: lines.reduce((sum, line) => sum + line.quantity, 0),
        subtotal,
        lines,
        cashier,
      };

      let sale: Sale;
      if (roll < 0.012) {
        sale = {
          ...base,
          receipt: `NC-${receiptNo}`,
          total: 0,
          discount: 0,
          payment: 'No charge',
          status: 'No charge',
          noChargeReason: pick(['Owner use', 'Staff first aid', 'Expired sample check']),
        };
      } else {
        const discount = rand() < 0.08 ? round(subtotal * 0.2) : 0;
        const total = round(subtotal - discount);
        if (roll < 0.72) {
          const tendered =
            total <= 20
              ? 20
              : total <= 50
                ? 50
                : total <= 100
                  ? 100
                  : total <= 200
                    ? 200
                    : total <= 500
                      ? 500
                      : 1000;
          sale = {
            ...base,
            total,
            discount,
            payment: 'Cash',
            amountPaid: tendered,
            change: round(tendered - total),
            creditBalance: 0,
            status: 'Completed',
          };
        } else if (roll < 0.92) {
          const pending = today && rand() < 0.3;
          sale = {
            ...base,
            total,
            discount,
            payment: 'GCash',
            amountPaid: pending ? 0 : total,
            change: 0,
            creditBalance: 0,
            gcashReference: String(1000000000000 + Math.floor(rand() * 8999999999999)),
            paymentStatus: pending ? 'Unpaid' : 'Paid',
            status: pending ? 'Pending GCash' : 'Completed',
          };
        } else {
          const down = rand() < 0.5 ? Math.min(total, Math.round((total * 0.3) / 10) * 10) : 0;
          sale = {
            ...base,
            total,
            discount,
            payment: 'Credit',
            customer: pick(CREDIT_CUSTOMERS),
            amountPaid: down,
            change: 0,
            creditBalance: round(total - down),
            downPayment: down,
            status: total - down > 0 ? 'Credit' : 'Completed',
          };
          if (total - down > 0) openCredits.push(sale);
        }
      }

      for (const line of lines) {
        movements.push({
          id: nextId('SALE'),
          date: sale.date,
          product: line.product,
          kind: 'Sale',
          change: -line.quantity,
          reference: sale.receipt,
          staff: 'Cashier',
          reason:
            sale.payment === 'No charge'
              ? `No charge: ${String(sale.noChargeReason)}`
              : 'Completed sale',
        });
      }

      // A few sales get voided a few minutes later: the stock goes back.
      if (sale.payment !== 'No charge' && rand() < 0.025) {
        const voidedAt = new Date(when.getTime() + 240000);
        const reason = pick(VOID_REASONS);
        Object.assign(sale, {
          status: 'Voided',
          creditBalance: 0,
          voidedAt: voidedAt.toISOString(),
          voidReason: reason,
        });
        const credit = openCredits.indexOf(sale);
        if (credit >= 0) openCredits.splice(credit, 1);
        voidLog.push({
          receipt: sale.receipt,
          date: voidedAt.toISOString(),
          reason,
          cashier,
          total: sale.total,
        });
        for (const line of lines) {
          const lot = batches
            .filter((batch) => batch.barcode === line.barcode)
            .sort((a, b) => a.expiry.localeCompare(b.expiry))
            .find((batch) => new Date(`${batch.expiry}T23:59:59`) >= when);
          if (lot) lot.stock += line.quantity;
          inventory.get(line.barcode)!.stock += line.quantity;
          movements.push({
            id: nextId('VOID'),
            date: voidedAt.toISOString(),
            product: line.product,
            kind: 'Adjustment',
            change: line.quantity,
            reference: sale.receipt,
            staff: cashier,
            reason: `Voided sale: ${reason}`,
          });
        }
      }
      sales.push(sale);
      shiftSales.push(sale);
    }

    // Utang collected during the shift (older credit sales).
    for (const credit of [...openCredits]) {
      if (new Date(credit.date) >= opened || rand() > 0.12) continue;
      const balance = Number(credit.creditBalance);
      const amount = rand() < 0.6 ? balance : Math.min(balance, Math.round(balance / 2));
      const paidAt = new Date(opened.getTime() + rand() * (closes.getTime() - opened.getTime()));
      credit.amountPaid = round(Number(credit.amountPaid) + amount);
      credit.creditBalance = round(balance - amount);
      if (Number(credit.creditBalance) <= 0) {
        credit.status = 'Completed';
        openCredits.splice(openCredits.indexOf(credit), 1);
      }
      events.push({
        id: nextId('UTANG'),
        type: 'Utang payment',
        amount,
        reason: `${String(credit.customer)} paid toward ${credit.receipt}`,
        date: paidAt.toISOString(),
      });
    }
    if (rand() < 0.25) {
      events.push({
        id: nextId('OUT'),
        type: 'Paid out',
        amount: pick([35, 60, 120, 150]),
        reason: pick([
          'Drinking water for the store',
          'Tricycle fare for a delivery',
          'Cleaning supplies',
          'Plastic bags',
        ]),
        date: new Date(opened.getTime() + rand() * 3600000 * 6).toISOString(),
      });
    }

    const kept = shiftSales.filter((sale) => sale.status !== 'Voided');
    const cashSales = round(
      kept.filter((sale) => sale.payment === 'Cash').reduce((sum, sale) => sum + sale.total, 0),
    );
    const creditCash = round(
      kept
        .filter((sale) => sale.payment === 'Credit')
        .reduce((sum, sale) => sum + Number(sale.downPayment ?? 0), 0) +
        events
          .filter((event) => event.type === 'Utang payment')
          .reduce((sum, event) => sum + event.amount, 0),
    );
    const sumOf = (type: CashEvent['type']) =>
      events.filter((event) => event.type === type).reduce((sum, event) => sum + event.amount, 0);

    if (today) {
      // Today's shift is still open: the cashier can keep selling or close it.
      const session: RegisterSession = {
        openedAt: opened.toISOString(),
        openingFloat: float,
        cashierName: cashier,
        onDutyNames: onDuty,
      };
      localStorage.setItem('dagohoy_demo_register_session', JSON.stringify(session));
      localStorage.setItem('dagohoy_demo_cash_events', JSON.stringify(events.reverse()));
      break;
    }

    // At closing the owner takes the sales home and leaves the float for tomorrow.
    const beforeTurnover = float + cashSales + creditCash + sumOf('Paid in') - sumOf('Paid out');
    const turnover = round(Math.max(0, beforeTurnover - FLOAT));
    if (turnover > 0) {
      events.push({
        id: nextId('OUT'),
        type: 'Paid out',
        amount: turnover,
        reason: 'Sales cash turned over to the owner',
        date: day(offset, 19, 55).toISOString(),
      });
    }
    const paidIn = sumOf('Paid in');
    const paidOut = sumOf('Paid out');
    const expectedCash = round(float + cashSales + creditCash + paidIn - paidOut);
    const short = rand() < 0.1 ? pick([-20, -5, 10]) : 0;
    const countedCash = round(expectedCash + short);
    const salesByPayment = kept.reduce<Record<string, number>>((counts, sale) => {
      counts[sale.payment] = (counts[sale.payment] ?? 0) + 1;
      return counts;
    }, {});
    shifts.push({
      id: nextId('SHIFT'),
      cashierName: cashier,
      onDutyNames: onDuty,
      openedAt: opened.toISOString(),
      closedAt: closes.toISOString(),
      openingFloat: float,
      salesCount: kept.length,
      salesByPayment,
      cashSales,
      creditCash,
      paidIn,
      paidOut,
      expectedCash,
      countedCash,
      varianceNote: short
        ? short < 0
          ? 'Gave wrong change, short in the drawer'
          : 'Customer did not wait for change'
        : undefined,
      // Filled in after the sales are saved (the report reads them from storage).
      details: undefined,
      _events: events,
    } as ShiftRecord & { _events: CashEvent[] });
    float = countedCash;
  }

  // 3. Save everything, newest first like the real pages do.
  const newestFirst = <T extends { date: string }>(list: T[]) =>
    [...list].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(
    'dagohoy_demo_inventory',
    JSON.stringify(
      [...inventory.values()].map(({ _seed, ...item }) => {
        void _seed;
        return item;
      }),
    ),
  );
  localStorage.setItem('dagohoy_demo_inventory_batches', JSON.stringify(batches));
  localStorage.setItem('dagohoy_demo_stock_movements', JSON.stringify(newestFirst(movements)));
  localStorage.setItem('dagohoy_demo_sales', JSON.stringify(newestFirst(sales)));
  localStorage.setItem('dagohoy_demo_void_log', JSON.stringify(newestFirst(voidLog)));
  localStorage.setItem(
    'dagohoy_demo_shift_history',
    JSON.stringify(
      shifts
        .map((shift) => {
          const { _events, ...record } = shift as ShiftRecord & { _events: CashEvent[] };
          return {
            ...record,
            details: collectShiftDetails(
              new Date(record.openedAt),
              new Date(record.closedAt),
              _events,
            ),
          };
        })
        .reverse()
        .slice(0, 60),
    ),
  );
  localStorage.setItem(
    'dagohoy_demo_suppliers',
    JSON.stringify(SUPPLIERS.map((supplier) => ({ ...supplier, products: 0, status: 'Active' }))),
  );
  localStorage.setItem(
    'dagohoy_demo_purchase_orders',
    JSON.stringify([
      {
        id: 'PO-0001',
        supplier: 'Zuellig Pharma',
        product: 'Omeprazole 20mg',
        productBarcode: '4806501740035',
        quantity: 100,
        created: day(-2, 10).toISOString(),
        status: 'Ordered',
      },
      {
        id: 'PO-0002',
        supplier: 'Davao Medical Supply',
        product: 'Betadine 60ml',
        productBarcode: '4800888160014',
        quantity: 12,
        created: day(-1, 15).toISOString(),
        status: 'Draft',
      },
    ]),
  );

  // Monthly bills and small purchases for this month and last month.
  const expenses = [-1, 0].flatMap((monthOffset) => {
    const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const on = (date: number) => isoDay(new Date(month.getFullYear(), month.getMonth(), date));
    const list = [
      ['Rent', 'Store rent', 'Bank transfer', 12000, 5],
      ['Utilities', 'Davao Light electric bill', 'GCash', 3850 + Math.round(rand() * 600), 12],
      ['Utilities', 'Water bill (DCWD)', 'GCash', 420 + Math.round(rand() * 80), 14],
      ['Utilities', 'Internet (PLDT Fibr)', 'GCash', 1699, 18],
      ['Payroll', 'Staff salary, 1st half', 'Cash', 9000, 15],
      ['Supplies', 'Receipt paper rolls and plastic bags', 'Cash', 650, 8],
      ['Transport', 'Pickup of delivery from supplier', 'Cash', 250, 21],
      ['Payroll', 'Staff salary, 2nd half', 'Cash', 9000, 28],
    ] as const;
    return list
      .filter(([, , , , date]) => monthOffset < 0 || date <= now.getDate())
      .map(([category, description, paymentMethod, amount, date], index) => ({
        id: `EXP-${monthOffset + 2}${index}`,
        date: on(date),
        category,
        description,
        paymentMethod,
        amount,
      }));
  });
  localStorage.setItem('dagohoy_demo_expenses', JSON.stringify(expenses.reverse()));

  // Staff names to pick from at Start shift (owner + cashiers).
  const roster: RosterStaff[] = ['Jeanette Boncales', ...STAFF].map((name, index) => ({
    id: `staff-${index + 1}`,
    name,
    status: 'Active',
    createdAt: day(-60).toISOString(),
  }));
  localStorage.setItem('dagohoy_demo_staff_roster', JSON.stringify(roster));

  window.dispatchEvent(new Event('dagohoy-store-status-change'));
  return { products: inventory.size, sales: sales.length, shifts: shifts.length };
}

/**
 * Copies the sample products (with their current stock as opening stock), suppliers and
 * staff names to the server, skipping any that already exist, then refreshes the browser
 * copies from the server.
 */
export async function pushSampleToServer() {
  const local = getInventory();
  const [serverProducts, serverSuppliers, serverStaff] = await Promise.all([
    listProducts(),
    listSuppliers(),
    listStaff(),
  ]);
  const barcodes = new Set(serverProducts.map((product) => product.barcode));
  const expiry = isoDay(day(365));
  for (const product of local.filter((item) => !barcodes.has(item.barcode))) {
    await createProduct({
      name: product.product,
      barcode: product.barcode,
      detail: product.detail,
      category: product.category ?? 'Other',
      unit: product.unit,
      price: Number(product.price.replace(/[₱,]/g, '')),
      cost: product.cost ?? null,
      opening:
        product.stock > 0
          ? { quantity: product.stock, lot: `SAMPLE-${product.barcode.slice(-4)}`, expiry }
          : undefined,
    });
  }
  const supplierNames = new Set(serverSuppliers.map((item) => item.name.toLowerCase()));
  for (const supplier of SUPPLIERS.filter((item) => !supplierNames.has(item.name.toLowerCase()))) {
    await createSupplier(supplier);
  }
  const staffNames = new Set(serverStaff.map((item) => item.name.toLowerCase()));
  for (const name of ['Jeanette Boncales', ...STAFF].filter(
    (item) => !staffNames.has(item.toLowerCase()),
  )) {
    await addStaff(name);
  }
  await syncFromServer();
}
