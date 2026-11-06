import type { StaffMember, WeeklyHoursEntry } from './types';

// Static sample content for the public landing page. Replace with API data in a later milestone.
export const pharmacyProfile = {
  name: 'Dagohoy Pharmacy',
  locationLabel: 'POS & Inventory Management System',
  timezone: 'Asia/Manila',
  phone: '[Contact number]',
  email: '[Pharmacy email]',
  address: '[Pharmacy address]',
  businessHours: 'Mon–Sat 8:00 AM–8:00 PM · Sun 9:00 AM–6:00 PM',
};

export const weeklyHours: WeeklyHoursEntry[] = [
  { day: 1, label: 'Monday', opensAt: '08:00', closesAt: '20:00' },
  { day: 2, label: 'Tuesday', opensAt: '08:00', closesAt: '20:00' },
  { day: 3, label: 'Wednesday', opensAt: '08:00', closesAt: '20:00' },
  { day: 4, label: 'Thursday', opensAt: '08:00', closesAt: '20:00' },
  { day: 5, label: 'Friday', opensAt: '08:00', closesAt: '20:00' },
  { day: 6, label: 'Saturday', opensAt: '08:00', closesAt: '20:00' },
  { day: 0, label: 'Sunday', opensAt: '09:00', closesAt: '18:00' },
];

export const staffOnDuty: StaffMember[] = [
  { initials: 'MD', role: 'Pharmacist', displayName: 'Maria D.' },
  { initials: 'A', role: 'Cashier', displayName: 'Ana' },
];

export const pharmacyFeatures = [
  {
    number: '01',
    title: 'Point of Sale',
    description: 'Fast and organized sales processing with barcode-ready workflows.',
    className: 'feature-panel--primary',
  },
  {
    number: '02',
    title: 'Inventory Management',
    description: 'Manage stock, batches, expiry dates, products, and receiving.',
    className: 'feature-panel--secondary',
  },
  {
    number: '03',
    title: 'Reports',
    description: 'View important sales and inventory information in one place.',
    className: 'feature-panel--tertiary',
  },
];

export const developerProfile = {
  name: 'Niel Adrian Garig',
  role: 'Software Developer',
  email: 'adrianniel.garig@gmail.com',
  services: ['Web Systems', 'POS Systems', 'Inventory Systems', 'Custom Business Software'],
  contacts: [
    { label: 'Phone', value: '09381437790', href: 'tel:09381437790' },
    {
      label: 'Email',
      value: 'adrianniel.garig@gmail.com',
      href: 'mailto:adrianniel.garig@gmail.com',
    },
    {
      label: 'Facebook / Messenger',
      value: 'facebook.com/niel.adrn',
      href: 'https://www.facebook.com/niel.adrn',
    },
  ],
};
