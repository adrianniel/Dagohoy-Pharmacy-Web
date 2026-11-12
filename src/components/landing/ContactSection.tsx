import { useEffect, useState } from 'react';
import { getSession } from '../../data/registerSession';
import { CashierIcon } from '../cashier/CashierIcon';
import { developerProfile, pharmacyProfile, weeklyHours } from './content';
import { getPharmacyStatus } from './pharmacyTime';
import './closing.css';

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
  return 'arrow';
}

function formatTime(value: string) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function ContactSection() {
  const [profile, setProfile] = useState(getPharmacyContact);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sync = () => setProfile(getPharmacyContact());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('pharmacy-settings-changed', sync);
    // Open or closed follows the clock.
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pharmacy-settings-changed', sync);
      window.clearInterval(tick);
    };
  }, []);

  const status = getPharmacyStatus(now, weeklyHours, pharmacyProfile.timezone);
  // The cashier picked when this device started the shift; nothing is shown otherwise.
  const onDuty = getSession()?.cashierName;

  // Only details the owner has filled in under Settings are shown.
  const pharmacyRows = [
    { label: 'Address', value: profile.address, icon: 'map' as const },
    { label: 'Phone', value: profile.phone, icon: 'phone' as const },
    { label: 'Email', value: profile.email, icon: 'mail' as const },
  ].filter((row) => row.value?.trim());

  return (
    <section className="reach" id="contact" aria-labelledby="contact-title">
      <div className="closing-wrap">
        <header className="reach__head">
          <h2 id="contact-title">
            <span>Visit the counter,</span> <span>or send a message.</span>
          </h2>
          <p>Questions about the pharmacy, or help with the system? Reach the right people.</p>
        </header>

        <div className="reach__grid">
          <article className="reach-card">
            <header className="reach-card__head">
              <span className="reach-card__icon" aria-hidden="true">
                <CashierIcon name="store" />
              </span>
              <div>
                <h3>{profile.name}</h3>
                <p>{profile.locationLabel}</p>
              </div>
            </header>

            <div className={`reach-status${status.isOpen ? ' is-open' : ''}`}>
              <span className="reach-status__dot" aria-hidden="true" />
              <strong>{status.message}</strong>
              <span>{status.nextChange}</span>
            </div>
            {onDuty && (
              <p className="reach-duty">
                On duty <strong>{onDuty}</strong>
              </p>
            )}

            <ul className="reach-hours" aria-label="Opening hours">
              {weeklyHours.map((entry) => (
                <li key={entry.day} className={entry.day === status.currentDay ? 'is-today' : ''}>
                  <span>{entry.label.slice(0, 3)}</span>
                  <strong>
                    {entry.opensAt && entry.closesAt
                      ? `${formatTime(entry.opensAt)} – ${formatTime(entry.closesAt)}`
                      : 'Closed'}
                  </strong>
                </li>
              ))}
            </ul>

            {pharmacyRows.length > 0 && (
              <div className="reach-rows">
                {pharmacyRows.map((row) => (
                  <div className="reach-row" key={row.label}>
                    <span className="reach-row__icon" aria-hidden="true">
                      <CashierIcon name={row.icon} />
                    </span>
                    <span className="reach-row__text">
                      <small>{row.label}</small>
                      <span>{row.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="reach-card">
            <header className="reach-card__head">
              <span className="reach-card__icon" aria-hidden="true">
                <CashierIcon name="staff" />
              </span>
              <div>
                <h3>System support</h3>
                <p>Developer and technical help</p>
              </div>
            </header>
            <div className="reach-rows">
              {developerProfile.contacts.map((contact) => (
                <a
                  className="reach-row is-link"
                  key={contact.label}
                  href={contact.href}
                  target={contact.href.startsWith('http') ? '_blank' : undefined}
                  rel={contact.href.startsWith('http') ? 'noreferrer' : undefined}
                >
                  <span className="reach-row__icon" aria-hidden="true">
                    <CashierIcon name={contactIcon(contact.label)} />
                  </span>
                  <span className="reach-row__text">
                    <small>{contact.label}</small>
                    <span>{contact.value}</span>
                  </span>
                  <svg className="reach-row__arrow" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
                  </svg>
                </a>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
