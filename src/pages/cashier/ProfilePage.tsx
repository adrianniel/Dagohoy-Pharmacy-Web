import { getCurrentAccount, getWorkspaceProfile } from '../../data/accountStore';
import { isStoreOpen } from '../../data/registerSession';

export function CashierProfilePage() {
  const account = getCurrentAccount();
  const profile = getWorkspaceProfile();
  const isCashier = account?.role === 'CASHIER';
  const storeOpen = isStoreOpen();

  return (
    <div className="cashier-page">
      <div className="cashier-profile-grid">
        <section className="cashier-panel cashier-profile-card">
          <div className="cashier-profile-card__identity">
            <span className="cashier-avatar cashier-avatar--large">{profile.initials}</span>
            <div>
              <h3>{profile.name}</h3>
              <p>{profile.roleLabel} · Dagohoy Pharmacy</p>
              <span className="cashier-profile-status">
                <i /> {profile.status}
              </span>
            </div>
          </div>
          <dl className="cashier-profile-details">
            <div>
              <dt>{isCashier ? 'Account' : 'Full name'}</dt>
              <dd>{isCashier ? 'Shared cashier account' : account?.displayName}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{profile.roleLabel}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{profile.username}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>
                {isCashier ? 'Changed by an administrator' : 'Change in Staff, Edit my account'}
              </dd>
            </div>
          </dl>
        </section>
        <aside className="cashier-panel cashier-shift-card">
          <p>Current shift</p>
          <h3>{storeOpen ? (isCashier ? profile.name : 'Register open') : 'No one on shift'}</h3>
          <span>
            {storeOpen
              ? 'Recorded when the register was opened.'
              : 'Open the cash drawer to start a shift.'}
          </span>
          <div>
            <small>Store</small>
            <strong>{storeOpen ? 'Open' : 'Closed'}</strong>
          </div>
          {isCashier && (
            <p className="cashier-shift-card__note">
              Everyone on the cashier team signs in with this one account. The name typed when
              opening the register is who appears on sales records and reports.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
