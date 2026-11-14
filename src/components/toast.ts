import { createContext, useContext, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';
/** A finished save worth a clear "done": an animated check, a title, what was saved. */
export type Success = { title: string; message: ReactNode; notes?: string[] };
export type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
  showSuccess: (success: Success) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return context;
}
