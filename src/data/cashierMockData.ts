export const dashboardSummary = [
  { label: "Today's Transactions", value: '24', detail: 'Since 8:00 AM', tone: 'neutral' },
  { label: "Today's Sales", value: '₱18,460.50', detail: 'Mock total', tone: 'green' },
  { label: 'Current Shift', value: 'Morning', detail: '8:00 AM – 4:00 PM', tone: 'neutral' },
  { label: 'Register Status', value: 'Open', detail: 'Register 01', tone: 'success' },
];

export const recentTransactions = [
  {
    receipt: 'DP-2026-0048',
    time: '10:42 AM',
    items: 3,
    total: '₱486.00',
    payment: 'Cash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0047',
    time: '10:18 AM',
    items: 5,
    total: '₱1,240.50',
    payment: 'GCash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0046',
    time: '9:51 AM',
    items: 2,
    total: '₱315.00',
    payment: 'Cash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0045',
    time: '9:24 AM',
    items: 1,
    total: '₱128.00',
    payment: 'Cash',
    status: 'Completed',
  },
];

export const mockProducts = [
  {
    barcode: '4800016642012',
    product: 'Biogesic 500mg',
    detail: 'Paracetamol / Unilab',
    unit: 'Tablet',
    price: '₱5.50',
    stock: 184,
    status: 'In Stock',
  },
  {
    barcode: '4806516731010',
    product: 'Neozep Forte',
    detail: 'Phenylephrine + CPM / Unilab',
    unit: 'Tablet',
    price: '₱8.75',
    stock: 42,
    status: 'In Stock',
  },
  {
    barcode: '4800361412025',
    product: 'Bioflu',
    detail: 'Phenylephrine + CPM / Unilab',
    unit: 'Tablet',
    price: '₱9.00',
    stock: 12,
    status: 'Low Stock',
  },
  {
    barcode: '4800488060185',
    product: 'Ascorbic Acid 500mg',
    detail: 'Vitamin C / Generic',
    unit: 'Tablet',
    price: '₱4.00',
    stock: 0,
    status: 'Out of Stock',
  },
  {
    barcode: '4800016021060',
    product: 'Tuseran Forte',
    detail: 'Dextromethorphan / Unilab',
    unit: 'Capsule',
    price: '₱10.25',
    stock: 65,
    status: 'In Stock',
  },
];

export const transactionHistory = [
  {
    receipt: 'DP-2026-0048',
    date: 'Oct 15, 2026 · 10:42 AM',
    items: 3,
    total: '₱486.00',
    payment: 'Cash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0047',
    date: 'Oct 15, 2026 · 10:18 AM',
    items: 5,
    total: '₱1,240.50',
    payment: 'GCash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0046',
    date: 'Oct 15, 2026 · 9:51 AM',
    items: 2,
    total: '₱315.00',
    payment: 'Cash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0045',
    date: 'Oct 15, 2026 · 9:24 AM',
    items: 1,
    total: '₱128.00',
    payment: 'Cash',
    status: 'Completed',
  },
  {
    receipt: 'DP-2026-0044',
    date: 'Oct 15, 2026 · 8:56 AM',
    items: 4,
    total: '₱672.75',
    payment: 'GCash',
    status: 'Completed',
  },
];

export const mockCartItems = [
  {
    product: 'Biogesic 500mg',
    detail: 'Tablet',
    quantity: 2,
    unit: 'pc',
    price: '₱5.50',
    subtotal: '₱11.00',
  },
  {
    product: 'Neozep Forte',
    detail: 'Tablet',
    quantity: 1,
    unit: 'pc',
    price: '₱8.75',
    subtotal: '₱8.75',
  },
];
