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

type CategorySuggestion = {
  id: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
};

export function suggestProductCategories(
  products: Array<{ id: string; name: string; detail?: string }>,
): Promise<CategorySuggestion[]> {
  return apiRequest<CategorySuggestion[]>('/products/ai-category-suggestions', {
    method: 'POST',
    body: JSON.stringify({ products }),
  });
}
