import { useEffect, useState } from 'react';
import { CashierIcon } from '../cashier/CashierIcon';
import { developerProfile, pharmacyProfile } from './mockData';

const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';

type PharmacyContact = typeof pharmacyProfile & {
  email?: string;
  businessHours?: string;
};

function getPharmacyContact(): PharmacyContact {
  try {
    const settings = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) ?? 'null',
    ) as Partial<PharmacyContact> | null;
    return {
      ...pharmacyProfile,
      name: settings?.name || pharmacyProfile.name,
      phone: settings?.phone || pharmacyProfile.phone,
      email: settings?.email || pharmacyProfile.email,
      address: settings?.address || pharmacyProfile.address,
      businessHours: settings?.businessHours || pharmacyProfile.businessHours,
    };
  } catch {
    return pharmacyProfile;
  }
}

function contactIcon(label: string): 'mail' | 'phone' | 'arrow' {
  if (label === 'Email') return 'mail';
  if (label === 'Phone') return 'phone';
  if (label === 'Facebook / Messenger') return 'arrow';
  if (label === 'Portfolio') return 'arrow';
  if (label === 'GitHub') return 'arrow';
  return 'arrow';
}

export function ContactSection() {
  const [profile, setProfile] = useState(getPharmacyContact);

  useEffect(() => {
    const sync = () => setProfile(getPharmacyContact());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('pharmacy-settings-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pharmacy-settings-changed', sync);
    };
  }, []);

  const pharmacyRows = [
    { label: 'Address', value: profile.address, icon: 'map' as const },
    { label: 'Phone', value: profile.phone, icon: 'phone' as const },
    { label: 'Email', value: profile.email, icon: 'mail' as const },
  ];

  return (
    <section className="contact-section section-wrap" id="contact" aria-labelledby="contact-title">
      <div className="contact-section__intro">
        <p className="eyebrow">Get in touch</p>
        <h2 id="contact-title">Contact &amp; support</h2>
        <p>Questions about the pharmacy or need help with the system? Reach the right team.</p>
      </div>
      <div className="contact-section__groups">
        <article className="contact-card contact-card--pharmacy">
          <header className="contact-card__header">
            <span className="contact-card__icon" aria-hidden="true">
              <CashierIcon name="store" />
            </span>
            <div>
              <h3>{profile.name}</h3>
              <p>{profile.locationLabel}</p>
            </div>
          </header>
          <div className="contact-card__rows">
            {pharmacyRows.map((row) => (
              <div className="contact-row" key={row.label}>
                <span className="contact-row__icon" aria-hidden="true">
                  <CashierIcon name={row.icon} />
                </span>
                <div className="contact-row__content">
                  <span className="contact-row__label">{row.label}</span>
                  <span className="contact-row__value">{row.value}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="contact-card contact-card--support">
          <header className="contact-card__header">
            <span className="contact-card__icon" aria-hidden="true">
              <CashierIcon name="staff" />
            </span>
            <div>
              <h3>System Support</h3>
              <p>Developer and technical assistance</p>
            </div>
          </header>
          <div className="contact-card__rows">
            <div className="contact-row">
              <span className="contact-row__icon" aria-hidden="true">
                <CashierIcon name="profile" />
              </span>
              <div className="contact-row__content">
                <span className="contact-row__label">Developer</span>
                <span className="contact-row__value">{developerProfile.name}</span>
              </div>
            </div>
            {developerProfile.contacts.map((contact) => (
              <div className="contact-row" key={contact.label}>
                <span className="contact-row__icon" aria-hidden="true">
                  <CashierIcon name={contactIcon(contact.label)} />
                </span>
                <div className="contact-row__content">
                  <span className="contact-row__label">{contact.label}</span>
                  <span className="contact-row__value">
                    {contact.href === '#' ? (
                      contact.value
                    ) : (
                      <a href={contact.href} target="_blank" rel="noreferrer">
                        {contact.value}
                      </a>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
