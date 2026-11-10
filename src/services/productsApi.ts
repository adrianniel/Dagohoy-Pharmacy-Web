import { apiRequest } from './apiClient';

export type BarcodeLookupResponse =
  | { found: false; source: 'local' }
  | {
      found: true;
      source: 'local';
      product: {
        id: number;
        barcode: string;
        name: string;
        genericName: string;
        brand: string | null;
        strength: string | null;
        dosageForm: string | null;
        productUnit: {
          id: number;
          code: string;
          name: string;
          conversionToBase: number;
        } | null;
        sellingPrice: number | null;
      };
    };

export function lookupProductByBarcode(barcode: string): Promise<BarcodeLookupResponse> {
  return apiRequest<BarcodeLookupResponse>(`/products/barcode/${encodeURIComponent(barcode)}`);
}
