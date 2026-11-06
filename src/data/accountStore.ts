import { ACCESS_TOKEN_KEY, USER_ROLE_KEY } from '../constants/app';
import { REGISTER_SESSION_KEY } from './registerSession';

/*
 * Local account store for the design phase.
 *
 * Rules (mirrors what the server will enforce later):
 * - The owner account is built in and can never be removed or disabled.
 * - Administrators can create other administrator accounts.
 * - There is exactly one shared cashier account. Who is actually working is
 *   recorded when the register is opened, not by separate cashier logins.
 * - Accounts use a username and password only (no email).
 *
 * Passwords are stored as SHA-256 hashes so they are not kept as plain text in
 * the bundle or browser storage. This is NOT real security: once the API is
 * connected, credentials are checked server-side with a slow hash (bcrypt or
 * argon2) and this file only keeps the signed-in session.
 */

export type AccountRole = 'ADMIN' | 'CASHIER';
export type AccountStatus = 'Active' | 'Disabled';

export type Account = {
  id: string;
  username: string;
  displayName: string;
  role: AccountRole;
  passwordHash: string;
  status: AccountStatus;
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

const ACCOUNTS_KEY = 'dagohoy_demo_accounts';
export const CURRENT_ACCOUNT_KEY = 'dagohoy_pharmacy_account_id';

const OWNER_ACCOUNT: Account = {
  id: 'owner',
  username: 'jeanette.admin',
  displayName: 'Jeanette Boncales',
  role: 'ADMIN',
  passwordHash: 'd8ef13d850de805ac15d0bee0355851e271a8cf008e2445ab2ed09eedb47586a',
  status: 'Active',
  builtIn: true,
  createdAt: '2026-11-06T00:00:00.000Z',
};

export const USERNAME_PATTERN = /^[a-z0-9._]{4,32}$/;
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function loadAccounts(): Account[] {
  let stored: Account[] = [];
  try {
    stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as Account[];
  } catch {
    stored = [];
  }
  const others = stored.filter((account) => account.id !== OWNER_ACCOUNT.id);
  const storedOwner = stored.find((account) => account.id === OWNER_ACCOUNT.id);
  // The owner always exists and stays an active administrator; only its name,
  // username and password may change.
  const owner: Account = {
    ...OWNER_ACCOUNT,
    username: storedOwner?.username ?? OWNER_ACCOUNT.username,
    displayName: storedOwner?.displayName ?? OWNER_ACCOUNT.displayName,
    passwordHash: storedOwner?.passwordHash ?? OWNER_ACCOUNT.passwordHash,
  };
  return [owner, ...others];
}

function saveAccounts(accounts: Account[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getCashierAccount(accounts = loadAccounts()): Account | undefined {
  return accounts.find((account) => account.role === 'CASHIER');
}

export function getCurrentAccount(): Account | undefined {
  const id = localStorage.getItem(CURRENT_ACCOUNT_KEY);
  return id ? loadAccounts().find((account) => account.id === id) : undefined;
}

export type SignInResult = { ok: true; account: Account } | { ok: false; message: string };

export async function signIn(
  username: string,
  password: string,
  role: AccountRole,
): Promise<SignInResult> {
  const normalized = username.trim().toLowerCase();
  const account = loadAccounts().find((item) => item.username === normalized);
  const hash = await hashPassword(password);
  if (!account || account.passwordHash !== hash) {
    return { ok: false, message: 'Incorrect username or password.' };
  }
  if (account.role !== role) {
    return {
      ok: false,
      message:
        account.role === 'ADMIN'
          ? 'This is an administrator account. Select Administrator to log in.'
          : 'This is the cashier account. Select Cashier to log in.',
    };
  }
  if (account.status === 'Disabled') {
    return { ok: false, message: 'This account is disabled. Ask the owner to enable it.' };
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, `local-session-${account.id}`);
  localStorage.setItem(USER_ROLE_KEY, account.role);
  localStorage.setItem(CURRENT_ACCOUNT_KEY, account.id);
  return { ok: true, account };
}

export function signOut() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(CURRENT_ACCOUNT_KEY);
}

export type AccountDraft = {
  username: string;
  displayName: string;
  role: AccountRole;
  password: string;
};

export function validateDraft(draft: AccountDraft, accounts = loadAccounts()): string | null {
  const username = draft.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 4–32 characters: lowercase letters, numbers, dots or underscores.';
  }
  if (accounts.some((account) => account.username === username)) {
    return 'That username is already taken.';
  }
  if (draft.role === 'CASHIER' && getCashierAccount(accounts)) {
    return 'The pharmacy already has its cashier account. Edit it instead.';
  }
  if (draft.role === 'ADMIN' && !draft.displayName.trim()) {
    return 'Enter the administrator’s name.';
  }
  if (draft.password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function createAccount(draft: AccountDraft): Promise<Account> {
  const accounts = loadAccounts();
  const error = validateDraft(draft, accounts);
  if (error) throw new Error(error);
  const account: Account = {
    id: crypto.randomUUID(),
    username: draft.username.trim().toLowerCase(),
    displayName: draft.role === 'CASHIER' ? 'Cashier' : draft.displayName.trim(),
    role: draft.role,
    passwordHash: await hashPassword(draft.password),
    status: 'Active',
    createdAt: new Date().toISOString(),
  };
  saveAccounts([...accounts, account]);
  return account;
}

export type AccountChanges = {
  username: string;
  displayName: string;
  /** Leave empty to keep the current password. */
  password: string;
};

/**
 * Who may edit an account: the owner can edit everyone; other administrators
 * can edit themselves and the cashier account. Cashiers cannot edit accounts.
 */
export function canEditAccount(editor: Account | undefined, target: Account): boolean {
  if (!editor || editor.role !== 'ADMIN') return false;
  if (editor.builtIn) return true;
  return target.id === editor.id || target.role === 'CASHIER';
}

export async function updateAccount(id: string, changes: AccountChanges): Promise<Account> {
  const accounts = loadAccounts();
  const target = accounts.find((account) => account.id === id);
  if (!target) throw new Error('That account no longer exists.');
  if (!canEditAccount(getCurrentAccount(), target)) {
    throw new Error('You do not have permission to change this account.');
  }
  const username = changes.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Username must be 4–32 characters: lowercase letters, numbers, dots or underscores.',
    );
  }
  if (accounts.some((account) => account.id !== id && account.username === username)) {
    throw new Error('That username is already taken.');
  }
  if (target.role === 'ADMIN' && !changes.displayName.trim()) {
    throw new Error('Enter the administrator’s name.');
  }
  if (changes.password && changes.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const updated: Account = {
    ...target,
    username,
    displayName: target.role === 'ADMIN' ? changes.displayName.trim() : target.displayName,
    passwordHash: changes.password ? await hashPassword(changes.password) : target.passwordHash,
  };
  saveAccounts(accounts.map((account) => (account.id === id ? updated : account)));
  return updated;
}

export function setAccountStatus(id: string, status: AccountStatus) {
  saveAccounts(
    loadAccounts().map((account) =>
      account.id === id && !account.builtIn ? { ...account, status } : account,
    ),
  );
}

export function deleteAccount(id: string) {
  saveAccounts(loadAccounts().filter((account) => account.id !== id || account.builtIn));
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
