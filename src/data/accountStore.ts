import { apiRequest } from '../services/apiClient';
import { REGISTER_SESSION_KEY } from './registerSession';

/*
 * Login accounts, kept on the server.
 *
 * Passwords are checked by the API (bcrypt) and the session lives in an httpOnly
 * cookie the browser code cannot read. This file only remembers WHO is logged in
 * (name and role, no secrets) so the screen can show it right away; the server
 * re-checks the session on every request.
 *
 * Rules (enforced by the server):
 * - The owner account is built in and can never be removed or disabled.
 * - Administrators can create other administrator accounts.
 * - There is exactly one shared cashier account. Who is actually working is
 *   recorded when the register is opened, not by separate cashier logins.
 * - Accounts use a username and password only (no email).
 */

export type AccountRole = 'ADMIN' | 'CASHIER';
export type AccountStatus = 'Active' | 'Disabled';

export type Account = {
  id: string;
  username: string;
  displayName: string;
  role: AccountRole;
  status: AccountStatus;
  /** The built-in owner account. */
  builtIn?: boolean;
  createdAt: string;
};

export type WorkspaceProfile = {
  name: string;
  shortName: string;
  initials: string;
  roleLabel: string;
  username: string;
  status: string;
};

type ApiAccount = {
  id: number;
  username: string;
  displayName: string;
  role: AccountRole;
  status: AccountStatus;
  isOwner: boolean;
  createdAt: string;
};

/** Who is logged in (display only). Session storage: cleared when the browser closes. */
const CURRENT_KEY = 'dagohoy_pharmacy_current_account';
/** Left over from the browser-only login; removed on the next login or check. */
const OLD_KEYS = [
  'dagohoy_demo_accounts',
  'dagohoy_pharmacy_access_token',
  'dagohoy_pharmacy_user_role',
  'dagohoy_pharmacy_account_id',
];

export const USERNAME_PATTERN = /^[a-z0-9._]{4,32}$/;
export const MIN_PASSWORD_LENGTH = 8;

const toAccount = (account: ApiAccount): Account => ({
  id: String(account.id),
  username: account.username,
  displayName: account.displayName,
  role: account.role,
  status: account.status,
  builtIn: account.isOwner,
  createdAt: account.createdAt,
});

/**
 * The browser copies of server data (sales, utang, stock, shift, suppliers, roster, settings).
 * They are refilled from the server after every login, and wiped on logout so the next person
 * at a shared counter computer cannot read the previous account's records.
 */
const SERVER_COPY_KEYS = [
  'dagohoy_demo_inventory',
  'dagohoy_demo_inventory_batches',
  'dagohoy_demo_stock_movements',
  'dagohoy_demo_purchase_orders',
  'dagohoy_demo_sales',
  'dagohoy_demo_void_log',
  'dagohoy_demo_register_session',
  'dagohoy_demo_cash_events',
  'dagohoy_demo_shift_history',
  'dagohoy_demo_expenses',
  'dagohoy_demo_suppliers',
  'dagohoy_demo_staff_roster',
  'dagohoy_demo_pharmacy_settings',
];

function remember(account: Account | null) {
  OLD_KEYS.forEach((key) => localStorage.removeItem(key));
  if (account) {
    const previous = getCurrentAccount();
    // Another account on this browser: its copies are not this account's to see.
    if (previous && previous.id !== account.id) clearServerCopies();
    sessionStorage.setItem(CURRENT_KEY, JSON.stringify(account));
  } else {
    sessionStorage.removeItem(CURRENT_KEY);
    clearServerCopies();
  }
}

function clearServerCopies() {
  SERVER_COPY_KEYS.forEach((key) => localStorage.removeItem(key));
}

/** The logged-in account as last confirmed by the server, or undefined. */
export function getCurrentAccount(): Account | undefined {
  try {
    return (
      (JSON.parse(sessionStorage.getItem(CURRENT_KEY) ?? 'null') as Account | null) ?? undefined
    );
  } catch {
    return undefined;
  }
}

/** Asks the server if the session is still valid. Null when logged out. */
export async function refreshSession(): Promise<Account | null> {
  try {
    const { account } = await apiRequest<{ account: ApiAccount }>('/auth/me');
    const current = toAccount(account);
    remember(current);
    return current;
  } catch (error) {
    // Only a refused session logs out; a server that cannot be reached keeps the screen.
    if ((error as { statusCode?: number }).statusCode === 401) remember(null);
    throw error;
  }
}

export type SignInResult = { ok: true; account: Account } | { ok: false; message: string };

export async function signIn(
  username: string,
  password: string,
  role: AccountRole,
): Promise<SignInResult> {
  try {
    const { account } = await apiRequest<{ account: ApiAccount }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim().toLowerCase(), password, role }),
    });
    const current = toAccount(account);
    remember(current);
    return { ok: true, account: current };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not log in. Try again.',
    };
  }
}

/** The server ended the session (expired or revoked): forget it and the copies here. */
export function forgetSession() {
  remember(null);
}

export async function signOut() {
  remember(null);
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Already logged out on the server, or the server is down: the screen is logged out anyway.
  }
}

/* ---- Accounts (Staff page) ---- */

export async function listAccounts(): Promise<Account[]> {
  return (await apiRequest<ApiAccount[]>('/users')).map(toAccount);
}

export type AccountDraft = {
  username: string;
  displayName: string;
  role: AccountRole;
  password: string;
};

export async function createAccount(draft: AccountDraft): Promise<Account> {
  return toAccount(
    await apiRequest<ApiAccount>('/users', {
      method: 'POST',
      body: JSON.stringify({ ...draft, username: draft.username.trim().toLowerCase() }),
    }),
  );
}

export type AccountChanges = {
  username: string;
  displayName: string;
  /** Leave empty to keep the current password. */
  password: string;
};

export async function updateAccount(id: string, changes: AccountChanges): Promise<Account> {
  const updated = toAccount(
    await apiRequest<ApiAccount>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        username: changes.username.trim().toLowerCase(),
        displayName: changes.displayName,
        ...(changes.password ? { password: changes.password } : {}),
      }),
    }),
  );
  if (updated.id === getCurrentAccount()?.id) remember(updated);
  return updated;
}

export async function setAccountStatus(id: string, status: AccountStatus): Promise<Account> {
  return toAccount(
    await apiRequest<ApiAccount>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: status === 'Active' }),
    }),
  );
}

export async function deleteAccount(id: string): Promise<void> {
  await apiRequest(`/users/${id}`, { method: 'DELETE' });
}

/**
 * Who may edit an account (to show or hide buttons; the server decides for real):
 * the owner can edit everyone; other administrators can edit themselves and the
 * cashier account. Cashiers cannot edit accounts.
 */
export function canEditAccount(editor: Account | undefined, target: Account): boolean {
  if (!editor || editor.role !== 'ADMIN') return false;
  if (editor.builtIn) return true;
  return target.id === editor.id || target.role === 'CASHIER';
}

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DP'
  );
}

function readShiftCashierName(): string | undefined {
  try {
    const session = JSON.parse(localStorage.getItem(REGISTER_SESSION_KEY) ?? 'null') as {
      cashierName?: string;
    } | null;
    return session?.cashierName?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Who the workspace header, sidebar and profile page should show. */
export function getWorkspaceProfile(): WorkspaceProfile {
  const account = getCurrentAccount();
  if (!account) {
    return {
      name: 'Signed out',
      shortName: 'Signed out',
      initials: 'DP',
      roleLabel: '',
      username: '',
      status: '',
    };
  }
  if (account.role === 'ADMIN') {
    return {
      name: account.displayName,
      shortName: account.displayName,
      initials: initialsOf(account.displayName),
      roleLabel: account.builtIn ? 'Owner' : 'Administrator',
      username: account.username,
      status: account.builtIn ? 'Owner workspace' : 'Administrator',
    };
  }
  const onShift = readShiftCashierName();
  return {
    name: onShift ?? 'Cashier account',
    shortName: onShift ?? 'Cashier',
    initials: onShift ? initialsOf(onShift) : 'CA',
    roleLabel: 'Cashier',
    username: account.username,
    status: onShift ? 'On shift' : 'No one on shift',
  };
}
