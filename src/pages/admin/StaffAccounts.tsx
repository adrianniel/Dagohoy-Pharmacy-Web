import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatusBadge } from '../../components/cashier/StatusBadge';
import { ControlDeck, ControlPanel, type ControlItem } from '../../components/ControlDeck';
import { PasswordInput } from '../../components/PasswordInput';
import { useToast } from '../../components/toast';
import {
  type Account,
  type AccountRole,
  canEditAccount,
  createAccount,
  deleteAccount,
  getCurrentAccount,
  listAccounts,
  MIN_PASSWORD_LENGTH,
  setAccountStatus,
  updateAccount,
} from '../../data/accountStore';

import { syncRoster } from '../../data/serverSync';
import { loadRoster, type RosterStaff } from '../../data/staffRoster';
import { addStaff, removeStaff, updateStaff } from '../../services/storeApi';

type StaffTab = 'roster' | 'cashier' | 'admins';

type FormState =
  | { kind: 'create'; role: AccountRole }
  | { kind: 'edit'; account: Account }
  | { kind: 'remove'; account: Account }
  | null;

export function StaffAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [roster, setRoster] = useState<RosterStaff[]>(loadRoster);
  const [form, setForm] = useState<FormState>(null);
  const { showToast } = useToast();
  const me = getCurrentAccount();
  const cashier = accounts.find((account) => account.role === 'CASHIER');
  const admins = accounts.filter((account) => account.role === 'ADMIN');
  const [tab, setTab] = useState<StaffTab>('roster');
  const activeStaff = roster.filter((staff) => staff.status === 'Active').length;

  const items: Array<ControlItem<StaffTab>> = [
    {
      key: 'roster',
      icon: 'staff',
      title: 'Staff roster',
      hint: `${activeStaff} active`,
      tone: 'forest',
      count: roster.length,
      about:
        'Only these names appear when a cashier starts a shift. Several can be on duty together.',
    },
    {
      key: 'cashier',
      icon: 'register',
      title: 'Cashier account',
      hint: cashier ? `Login: ${cashier.username}` : 'Not created yet',
      tone: 'teal',
      alert: !cashier,
      count: cashier ? undefined : '!',
      about:
        'One shared login for the whole cashier team. Each cashier picks their name when the shift starts, so receipts and reports show who was on duty.',
    },
    {
      key: 'admins',
      icon: 'profile',
      title: 'Administrators',
      hint: 'Owner and managers',
      tone: 'slate',
      count: admins.length,
      about: 'Administrators manage products, stock, reports, staff and settings.',
    },
  ];
  const current = items.find((item) => item.key === tab);

  const loadAccountList = useCallback(async () => {
    try {
      setAccounts(await listAccounts());
      setAccountsError('');
    } catch (caught) {
      setAccountsError(caught instanceof Error ? caught.message : 'Could not load the accounts.');
    }
  }, []);

  useEffect(() => {
    void loadAccountList();
  }, [loadAccountList]);

  function refresh() {
    void loadAccountList();
    setRoster(loadRoster());
  }

  /** Saves a roster change on the server, then refreshes the list everyone picks from. */
  async function rosterChange(save: () => Promise<unknown>, done: string) {
    try {
      await save();
      await syncRoster();
      setRoster(loadRoster());
      showToast(done, 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Could not update the roster.', 'error');
    }
  }

  async function toggleStatus(account: Account) {
    const next = account.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await setAccountStatus(account.id, next);
      refresh();
      showToast(
        next === 'Disabled'
          ? `${labelOf(account)} can no longer log in.`
          : `${labelOf(account)} can log in again.`,
      );
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : 'Could not change the account.',
        'error',
      );
    }
  }

  return (
    <div className="staff-accounts">
      <ControlDeck
        id="staff"
        title="Staff"
        subtitle="Pick who to manage. It opens in the card below."
        active={tab}
        onSelect={setTab}
        items={items}
      />
      <ControlPanel
        id="staff"
        activeKey={tab}
        title={current?.title ?? 'Staff'}
        about={current?.about}
        actions={
          tab === 'admins' ? (
            <button
              className="cashier-primary-action"
              type="button"
              onClick={() => setForm({ kind: 'create', role: 'ADMIN' })}
            >
              Add administrator <span>＋</span>
            </button>
          ) : undefined
        }
      >
        {tab === 'roster' && (
          <StaffRoster
            roster={roster}
            onAdd={(name) =>
              rosterChange(() => addStaff(name), `${name.trim()} added to the roster.`)
            }
            onToggle={(staff) =>
              rosterChange(
                () => updateStaff(staff.id, { active: staff.status !== 'Active' }),
                staff.status === 'Active'
                  ? `${staff.name} is now inactive.`
                  : `${staff.name} is active again.`,
              )
            }
            onRename={(staff, name) =>
              rosterChange(() => updateStaff(staff.id, { name }), 'Name updated.')
            }
            onRemove={(staff) =>
              rosterChange(
                () => removeStaff(staff.id),
                `${staff.name} was removed from the roster.`,
              )
            }
          />
        )}

        {accountsError && tab !== 'roster' && (
          <p className="pos-notice" role="alert">
            {accountsError}
          </p>
        )}

        {tab === 'cashier' && (
          <section className="cashier-panel">
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
                    onClick={() => setForm({ kind: 'edit', account: cashier })}
                  >
                    Edit username / password
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
        )}

        {tab === 'admins' && (
          <section className="cashier-panel cashier-list-panel">
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
                    const canEdit = canEditAccount(me, account);
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
                            {canEdit && (
                              <button
                                className="cashier-view-button"
                                type="button"
                                onClick={() => setForm({ kind: 'edit', account })}
                              >
                                {isMe ? 'Edit my account' : 'Edit account'}
                              </button>
                            )}
                            {canEdit && !account.builtIn && !isMe && (
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
              <span>
                {me?.builtIn
                  ? 'The owner account cannot be disabled or removed.'
                  : 'Only the owner can change other administrators.'}
              </span>
            </div>
          </section>
        )}
      </ControlPanel>

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
      {form?.kind === 'edit' && (
        <EditAccountModal
          account={form.account}
          isSelf={form.account.id === me?.id}
          onClose={() => setForm(null)}
          onSubmit={async (changes) => {
            await updateAccount(form.account.id, changes);
            refresh();
            setForm(null);
            showToast(
              changes.password ? 'Account and password updated.' : 'Account updated.',
              'success',
            );
          }}
        />
      )}
      {form?.kind === 'remove' && (
        <ConfirmRemoveModal
          account={form.account}
          onClose={() => setForm(null)}
          onConfirm={async () => {
            try {
              await deleteAccount(form.account.id);
              refresh();
              setForm(null);
              showToast(`${form.account.displayName} was removed.`);
            } catch (caught) {
              showToast(
                caught instanceof Error ? caught.message : 'Could not remove the account.',
                'error',
              );
            }
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
  onClose,
  onSubmit,
}: {
  title: string;
  role: AccountRole;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [username, setUsername] = useState(role === 'CASHIER' ? 'cashier' : '');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
          {role === 'CASHIER'
            ? 'Every cashier will log in with this username and password.'
            : 'No email needed. Give the username and password to the new administrator.'}
        </p>
        {role === 'ADMIN' && (
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
        <label>
          Password
          <PasswordInput
            required
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
          <PasswordInput
            required
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
          {saving ? 'Saving…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

function EditAccountModal({
  account,
  isSelf,
  onClose,
  onSubmit,
}: {
  account: Account;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (changes: { username: string; displayName: string; password: string }) => Promise<void>;
}) {
  const isCashier = account.role === 'CASHIER';
  const [displayName, setDisplayName] = useState(account.displayName);
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const title = isCashier
    ? 'Edit cashier account'
    : isSelf
      ? 'Edit my account'
      : `Edit ${account.displayName}`;

  return (
    <div className="pos-modal-backdrop">
      <form className="pos-payment-modal" onSubmit={submit} noValidate>
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close form">
          ×
        </button>
        <h2>{title}</h2>
        <p className="inventory-form-note">
          {isCashier
            ? 'Only administrators can change the cashier login. Tell your cashiers the new details.'
            : 'Leave the password fields empty to keep the current password.'}
        </p>
        {!isCashier && (
          <label>
            Full name
            <input
              required
              autoComplete="off"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError('');
              }}
            />
          </label>
        )}
        <label>
          Username
          <input
            required
            autoFocus
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
        <label>
          New password (optional)
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
          />
        </label>
        <label>
          Confirm new password
          <PasswordInput
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
          {saving ? 'Saving…' : 'Save changes'}
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
  onConfirm: () => Promise<void>;
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

function StaffRoster({
  roster,
  onAdd,
  onToggle,
  onRename,
  onRemove,
}: {
  roster: RosterStaff[];
  onAdd: (name: string) => void;
  onToggle: (staff: RosterStaff) => void;
  onRename: (staff: RosterStaff, name: string) => void;
  onRemove: (staff: RosterStaff) => void;
}) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const activeCount = roster.filter((staff) => staff.status === 'Active').length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName);
    setNewName('');
  }

  return (
    <section className="cashier-panel staff-roster">
      <form className="staff-roster__add" onSubmit={submit}>
        <label>
          Staff name
          <input
            autoComplete="off"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Maria Dela Cruz"
          />
        </label>
        <button className="cashier-primary-action" type="submit">
          Add to roster <span>＋</span>
        </button>
      </form>
      {roster.length ? (
        <ul className="staff-roster__list">
          {roster.map((staff) => (
            <li key={staff.id} className={staff.status === 'Inactive' ? 'is-inactive' : ''}>
              {editing === staff.id ? (
                <form
                  className="staff-roster__rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRename(staff, editName);
                    setEditing(null);
                  }}
                >
                  <input
                    autoFocus
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    aria-label={`New name for ${staff.name}`}
                  />
                  <button className="cashier-view-button" type="submit">
                    Save
                  </button>
                  <button
                    className="cashier-view-button"
                    type="button"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    <strong>{staff.name}</strong>
                    <StatusBadge value={staff.status} />
                  </span>
                  <div className="staff-row-actions">
                    <button
                      className="cashier-view-button"
                      type="button"
                      onClick={() => {
                        setEditing(staff.id);
                        setEditName(staff.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="cashier-view-button"
                      type="button"
                      onClick={() => onToggle(staff)}
                    >
                      {staff.status === 'Active' ? 'Set inactive' : 'Set active'}
                    </button>
                    <button
                      className="cashier-view-button"
                      type="button"
                      onClick={() => onRemove(staff)}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cashier-shift-empty">
          No staff on the roster yet. Add the cashiers working the counter.
        </p>
      )}
      <div className="cashier-table-footer">
        <span>
          {roster.length} name{roster.length === 1 ? '' : 's'} · {activeCount} active
        </span>
        <span>Cashiers can only pick names from this list.</span>
      </div>
    </section>
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
