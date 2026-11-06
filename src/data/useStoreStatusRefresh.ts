import { useEffect, useReducer } from 'react';
import { STORE_STATUS_CHANGE_EVENT } from './registerSession';

/**
 * Re-renders the caller when the register opens or closes, so anything that
 * shows the cashier on shift (sidebar, header menu) stays current.
 */
export function useStoreStatusRefresh() {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    window.addEventListener(STORE_STATUS_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(STORE_STATUS_CHANGE_EVENT, refresh);
  }, []);
}
