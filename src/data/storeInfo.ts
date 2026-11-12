/** Pharmacy name, address and phone from the saved settings, for printed documents. */
export function readStore() {
  try {
    const settings = JSON.parse(localStorage.getItem('dagohoy_demo_pharmacy_settings') ?? '{}') as {
      name?: string;
      address?: string;
      phone?: string;
    };
    return {
      name: settings.name?.trim() || 'Dagohoy Pharmacy',
      address: settings.address?.trim() || '',
      phone: settings.phone?.trim() || '',
    };
  } catch {
    return { name: 'Dagohoy Pharmacy', address: '', phone: '' };
  }
}
