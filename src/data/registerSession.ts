export const REGISTER_SESSION_KEY = 'dagohoy_demo_register_session';
export const STORE_STATUS_CHANGE_EVENT = 'dagohoy-store-status-change';

export function isStoreOpen(): boolean {
  return Boolean(localStorage.getItem(REGISTER_SESSION_KEY));
}

export function notifyStoreStatusChange(): void {
  window.dispatchEvent(new Event(STORE_STATUS_CHANGE_EVENT));
}
