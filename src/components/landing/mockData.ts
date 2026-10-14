import type { StaffMember, WeeklyHoursEntry } from './types';

// Temporary development content. Replace this module with API-backed data later.
export const pharmacyProfile = {
  name: 'Dagohoy Pharmacy',
  locationLabel: 'Your neighborhood pharmacy',
  timezone: 'Asia/Manila',
  phone: '[Pharmacy phone number]',
  email: '[Pharmacy email address]',
  address: '[Pharmacy street address]',
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
  { initials: 'PD', role: 'Pharmacist', displayName: 'On shift' },
  { initials: 'CS', role: 'Pharmacy associate', displayName: 'On shift' },
];

export const pharmacyFeatures = [
  {
    number: '01',
    title: 'Point of sale',
    description:
      'A clear checkout workspace for pharmacy staff, designed to keep everyday transactions moving.',
    className: 'feature-panel--primary',
  },
  {
    number: '02',
    title: 'Stock control',
    description:
      'A practical view of products and quantities to help the team keep shelves organized.',
    className: 'feature-panel--secondary',
  },
  {
    number: '03',
    title: 'Batch awareness',
    description:
      'Product lots and expiry dates stay part of the workflow, ready for careful stock handling.',
    className: 'feature-panel--tertiary',
  },
];

export const developerProfile = {
  name: '[Developer name]',
  role: 'Full-stack developer',
  email: '[Developer contact email]',
  services: ['Web application development', 'System integration', 'Ongoing improvements'],
};
