import { USER_ROLE_KEY } from '../../constants/app';
import { adminProfile, cashierProfile } from '../../data/cashierMockData';

export function CashierProfilePage() {
  const profile = localStorage.getItem(USER_ROLE_KEY) === 'ADMIN' ? adminProfile : cashierProfile;
  return (
    <div className="cashier-page">
      <div className="cashier-profile-grid">
        <section className="cashier-panel cashier-profile-card">
          <div className="cashier-profile-card__identity">
            <span className="cashier-avatar cashier-avatar--large">{profile.initials}</span>
            <div>
              <h3>{profile.name}</h3>
              <p>{profile.role} · Dagohoy Pharmacy</p>
              <span className="cashier-profile-status">
                <i /> {profile.status}
              </span>
            </div>
          </div>
          <dl className="cashier-profile-details">
            <div>
              <dt>Full name</dt>
              <dd>{profile.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{profile.role.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{profile.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
            </div>
          </dl>
        </section>
        <aside className="cashier-panel cashier-shift-card">
          <p>Current assignment</p>
          <h3>{profile.shift}</h3>
          <span>8:00 AM – 4:00 PM</span>
          <div>
            <small>Register</small>
            <strong>Register 01</strong>
          </div>
          <p className="cashier-shift-card__note">
            Shift and register information are mock placeholders.
          </p>
        </aside>
      </div>
    </div>
  );
}
