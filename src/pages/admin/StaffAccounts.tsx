import { FormEvent, useState } from 'react';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { useToast } from '../../components/toast';
import {
  type Account,
  type AccountRole,
  createAccount,
  deleteAccount,
  getCashierAccount,
  getCurrentAccount,
  loadAccounts,
  MIN_PASSWORD_LENGTH,
  resetPassword,
  setAccountStatus,
} from '../../data/accountStore';

type FormState =
  | { kind: 'create'; role: AccountRole }
  | { kind: 'reset'; account: Account }
  | { kind: 'remove'; account: Account }
  | null;

export function StaffAccounts() {
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [form, setForm] = useState<FormState>(null);
  const { showToast } = useToast();
  const me = getCurrentAccount();
  const cashier = getCashierAccount(accounts);
  const admins = accounts.filter((account) => account.role === 'ADMIN');

  function refresh() {
    setAccounts(loadAccounts());
  }

  function toggleStatus(account: Account) {
    const next = account.status === 'Active' ? 'Disabled' : 'Active';
    setAccountStatus(account.id, next);
    refresh();
    showToast(
      next === 'Disabled'
        ? `${labelOf(account)} can no longer log in.`
        : `${labelOf(account)} can log in again.`,
    );
  }

  return (
    <div className="staff-accounts">
      <section className="cashier-panel" aria-labelledby="cashier-account-title">
        <div className="cashier-panel__heading">
          <div>
            <h3 id="cashier-account-title">Cashier account</h3>
            <p>
              One shared login for the whole cashier team. Each cashier types their name when they
              open the register, so receipts and reports show who was on shift.
            </p>
          </div>
        </div>
        {cashier ? (
          <div className="staff-cashier-card">
            <span className="cashier-avatar cashier-avatar--table">CA</span>
            <div className="staff-cashier-card__copy">
              <strong>{cashier.username}</strong>
              <span>
                Created {formatDate(cashier.createdAt)} · <StatusBadge value={cashier.status} />
              </span>
            </div>
            <div className="staff-cashier-card__actions">
              <button
                className="cashier-view-button"
                type="button"
                onClick={() => setForm({ kind: 'reset', account: cashier })}
              >
                Reset password
              </button>
              <button
                className="cashier-view-button"
                type="button"
                onClick={() => toggleStatus(cashier)}
              >
                {cashier.status === 'Active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ) : (
          <div className="expenses-empty-state">
            <strong>No cashier account yet</strong>
            <span>Create the login your cashiers will use at the counter.</span>
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setForm({ kind: 'create', role: 'CASHIER' })}
            >
              Create cashier account <span>＋</span>
            </button>
          </div>
        )}
      </section>

      <section className="cashier-panel cashier-list-panel" aria-labelledby="admin-accounts-title">
        <div className="cashier-panel__heading">
          <div>
            <h3 id="admin-accounts-title">Administrators</h3>
            <p>Administrators manage products, stock, reports, staff and settings.</p>
          </div>
          <button
            className="cashier-primary-action"
            type="button"
            onClick={() => setForm({ kind: 'create', role: 'ADMIN' })}
          >
            Add administrator <span>＋</span>
          </button>
        </div>
        <div
          className="cashier-table-wrap"
          role="region"
          aria-label="Administrator accounts"
          tabIndex={0}
        >
          <table className="cashier-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((account) => {
                const isMe = account.id === me?.id;
                const canReset = account.builtIn ? isMe : true;
                return (
                  <tr key={account.id}>
                    <td>
                      <span className="cashier-avatar cashier-avatar--table">
                        {initialsOf(account.displayName)}
                      </span>
                      <span>
                        <strong>
                          {account.displayName}
                          {isMe ? ' (you)' : ''}
                        </strong>
                        <br />
                        <span className="staff-username">{account.username}</span>
                      </span>
                    </td>
                    <td>{account.builtIn ? 'Owner' : 'Administrator'}</td>
                    <td>
                      <StatusBadge value={account.status} />
                    </td>
                    <td>
                      <div className="staff-row-actions">
                        {canReset && (
                          <button
                            className="cashier-view-button"
                            type="button"
                            onClick={() => setForm({ kind: 'reset', account })}
                          >
                            {isMe ? 'Change password' : 'Reset password'}
                          </button>
                        )}
                        {!account.builtIn && !isMe && (
                          <>
                            <button
                              className="cashier-view-button"
                              type="button"
                              onClick={() => toggleStatus(account)}
                            >
                              {account.status === 'Active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              className="cashier-view-button"
                              type="button"
                              onClick={() => setForm({ kind: 'remove', account })}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cashier-table-footer">
          <span>
            {admins.length} administrator{admins.length === 1 ? '' : 's'}
          </span>
          <span>The owner account cannot be disabled or removed.</span>
        </div>
      </section>

      {form?.kind === 'create' && (
        <AccountFormModal
          title={form.role === 'CASHIER' ? 'Create cashier account' : 'Add administrator'}
          role={form.role}
          onClose={() => setForm(null)}
          onSubmit={async ({ username, displayName, password }) => {
            await createAccount({ username, displayName, password, role: form.role });
            refresh();
            setForm(null);
            showToast(
              form.role === 'CASHIER' ? 'Cashier account created.' : 'Administrator added.',
              'success',
            );
          }}
        />
      )}
      {form?.kind === 'reset' && (
        <AccountFormModal
          title={
            form.account.id === me?.id
              ? 'Change your password'
              : `Reset ${labelOf(form.account)} password`
          }
          resetFor={form.account}
          onClose={() => setForm(null)}
          onSubmit={async ({ password }) => {
            await resetPassword(form.account.id, password);
            refresh();
            setForm(null);
            showToast('Password updated.', 'success');
          }}
        />
      )}
      {form?.kind === 'remove' && (
        <ConfirmRemoveModal
          account={form.account}
          onClose={() => setForm(null)}
          onConfirm={() => {
            deleteAccount(form.account.id);
            refresh();
            setForm(null);
            showToast(`${form.account.displayName} was removed.`);
          }}
        />
      )}
    </div>
  );
}

type FormValues = { username: string; displayName: string; password: string };

function AccountFormModal({
  title,
  role,
  resetFor,
  onClose,
  onSubmit,
}: {
  title: string;
  role?: AccountRole;
  resetFor?: Account;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [username, setUsername] = useState(role === 'CASHIER' ? 'cashier' : '');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isReset = Boolean(resetFor);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ username, displayName, password });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the account.');
      setSaving(false);
    }
  }

  return (
    <div className="pos-modal-backdrop">
      <form className="pos-payment-modal" onSubmit={submit} noValidate>
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close form">
          ×
        </button>
        <h2>{title}</h2>
        <p className="inventory-form-note">
          {isReset
            ? `Signs in as ${resetFor?.username}. Share the new password in person.`
            : role === 'CASHIER'
              ? 'Every cashier will log in with this username and password.'
              : 'No email needed. Give the username and password to the new administrator.'}
        </p>
        {!isReset && role === 'ADMIN' && (
          <label>
            Full name
            <input
              required
              autoFocus
              autoComplete="off"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError('');
              }}
            />
          </label>
        )}
        {!isReset && (
          <label>
            Username
            <input
              required
              autoFocus={role === 'CASHIER'}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value.toLowerCase());
                setError('');
              }}
            />
          </label>
        )}
        <label>
          {isReset ? 'New password' : 'Password'}
          <input
            required
            autoFocus={isReset}
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
          />
        </label>
        <label>
          Confirm password
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError('');
            }}
          />
        </label>
        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}
        <button className="pos-checkout-button" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isReset ? 'Save new password' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

function ConfirmRemoveModal({
  account,
  onClose,
  onConfirm,
}: {
  account: Account;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="pos-modal-backdrop">
      <div
        className="pos-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-title"
      >
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="remove-title">Remove {account.displayName}?</h2>
        <p className="inventory-form-note">
          They will no longer be able to log in. Their past activity stays in the records.
        </p>
        <button className="pos-checkout-button" type="button" onClick={onConfirm} autoFocus>
          Remove administrator
        </button>
      </div>
    </div>
  );
}

function labelOf(account: Account) {
  return account.role === 'CASHIER' ? 'The cashier account' : account.displayName;
}

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { dateStyle: 'medium' });
}
