import { useEffect, useSyncExternalStore } from 'react';
import { getBilling, type ApiBilling } from './storeApi';

/** Fired after a subscription payment is sent, so every screen that shows it refreshes. */
export const BILLING_CHANGED = 'dagohoy-billing-changed';

export const notifyBillingChanged = () => window.dispatchEvent(new Event(BILLING_CHANGED));

/*
 * One shared copy of the subscription status for every screen (owner or cashier), loaded once
 * and refreshed after a payment is sent, when the window gets focus, and every 5 minutes, so
 * the barcode scanner comes back on by itself once a payment is in.
 */
let current: ApiBilling | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loading ??= getBilling()
    .then((view) => {
      current = view;
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined) // keep the last answer: never block work on a failed check
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void load();
    const timer = window.setInterval(load, 5 * 60_000);
    window.addEventListener(BILLING_CHANGED, load);
    window.addEventListener('focus', load);
    stop = () => {
      window.clearInterval(timer);
      window.removeEventListener(BILLING_CHANGED, load);
      window.removeEventListener('focus', load);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}
let stop = () => {};

/** The subscription status. Null while loading or when the server cannot answer. */
export function useBilling(): ApiBilling | null {
  const billing = useSyncExternalStore(subscribe, () => current);
  // A fresh check whenever a screen that shows it opens.
  useEffect(() => {
    void load();
  }, []);
  return billing;
}

/**
 * True while the subscription is unpaid past its 7-day allowance: every barcode function is off
 * (scanning, barcode search, filling in new products). Searching by name still works.
 */
export function useScannerOff(): boolean {
  return useBilling()?.lookupActive === false;
}

export const SCANNER_OFF_MESSAGE =
  'Barcode scanner is off: the subscription is not paid. Search by product name instead.';
