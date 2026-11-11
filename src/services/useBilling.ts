import { useEffect, useState } from 'react';
import { getBilling, type ApiBilling } from './storeApi';

/** Fired after a subscription payment is sent, so every screen that shows it refreshes. */
export const BILLING_CHANGED = 'dagohoy-billing-changed';

export const notifyBillingChanged = () => window.dispatchEvent(new Event(BILLING_CHANGED));

/**
 * The subscription status for the logged-in account (owner or cashier). Reloads after a payment
 * is sent, when the window gets focus again, and every 5 minutes, so the barcode scanner comes
 * back on by itself once a payment is in. Null while loading or when the server cannot answer.
 */
export function useBilling(): ApiBilling | null {
  const [billing, setBilling] = useState<ApiBilling | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getBilling()
        .then((view) => alive && setBilling(view))
        .catch(() => undefined); // keep the last answer: never block work on a failed check
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    window.addEventListener(BILLING_CHANGED, load);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(BILLING_CHANGED, load);
      window.removeEventListener('focus', load);
    };
  }, []);
  return billing;
}
