import { CashierPageHeader } from '../../components/cashier/CashierPageHeader';
import { cashierProfile } from '../../data/cashierMockData';

export function CashierProfilePage() {
  return (
    <div className="cashier-page">
      <CashierPageHeader
        eyebrow="Account"
        title="My Profile"
        description="Basic information for the currently displayed cashier account."
      />
      <div className="cashier-profile-grid">
        <section className="cashier-panel cashier-profile-card">
          <div className="cashier-profile-card__identity">
            <span className="cashier-avatar cashier-avatar--large">{cashierProfile.initials}</span>
            <div>
              <h3>{cashierProfile.name}</h3>
              <p>Cashier · Dagohoy Pharmacy</p>
              <span className="cashier-profile-status">
                <i /> {cashierProfile.status}
              </span>
            </div>
          </div>
          <dl className="cashier-profile-details">
            <div>
              <dt>Full name</dt>
              <dd>{cashierProfile.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>CASHIER</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{cashierProfile.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{cashierProfile.email}</dd>
            </div>
          </dl>
        </section>
        <aside className="cashier-panel cashier-shift-card">
          <p>Current assignment</p>
          <h3>{cashierProfile.shift}</h3>
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
