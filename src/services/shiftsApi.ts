import type { ShiftDetails, ShiftRecord } from '../data/shiftHistory';
import { apiRequest } from './apiClient';

/* Shifts and the cash drawer on the server. */

export type ApiOpenShift = {
  id: number;
  openedAt: string;
  openingFloat: number;
  cashierName: string;
  onDutyNames: string[];
  floatAdjustment?: { carriedOver: number; reason: string };
};

export type ApiCurrentShift = {
  shift: ApiOpenShift | null;
  cashEvents: Array<{
    id: number;
    type: 'Paid in' | 'Paid out';
    amount: number;
    reason: string;
    date: string;
  }>;
  carriedOverFloat: number;
};

export const getCurrentShift = () => apiRequest<ApiCurrentShift>('/shifts/current');

export const listShiftHistory = () => apiRequest<ShiftRecord[]>('/shifts');

export const openShift = (input: {
  onDutyNames: string[];
  openingFloat: number;
  adjustmentReason?: string;
}) => apiRequest<ApiCurrentShift>('/shifts', { method: 'POST', body: JSON.stringify(input) });

export const recordCashEvent = (input: {
  type: 'paid_in' | 'paid_out';
  amount: number;
  reason: string;
}) =>
  apiRequest<ApiCurrentShift>('/shifts/current/cash-events', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const closeShift = (input: {
  countedCash: number;
  varianceNote?: string;
  cashSales: number;
  creditCash: number;
  salesCount: number;
  salesByPayment: Record<string, number>;
  details: ShiftDetails;
}) =>
  apiRequest<ShiftRecord>('/shifts/current/close', {
    method: 'POST',
    body: JSON.stringify(input),
  });
