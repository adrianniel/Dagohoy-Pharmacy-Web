import { useEffect, useState, type CSSProperties } from 'react';
import developerPhoto from '../../assets/developer.jpg';
import { getSession } from '../../data/registerSession';
import { getPublicSettings } from '../../services/storeApi';
import { developerProfile, pharmacyProfile, weeklyHours as defaultHours } from './content';
import type { WeeklyHoursEntry } from './types';
import { getPharmacyStatus } from './pharmacyTime';
import './closing.css';

const SETTINGS_KEY = 'dagohoy_demo_pharmacy_settings';
/** The day timeline runs from 6 AM to 10 PM, the part of the day the store can be open. */
const DAY_START = 6 * 60;
const DAY_END = 22 * 60;

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

const toMinutes = (value: string) => {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
};

/** 8:00 AM, or 8 AM in short form. */
function formatTime(value: string, short = false) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const shown = hour % 12 || 12;
  if (short) {
    return `${shown}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${period === 'AM' ? 'a' : 'p'}`;
  }
  return `${shown}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Minutes since midnight in the store's own time zone. */
function storeMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: pharmacyProfile.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return read('hour') * 60 + read('minute');
}

/** Where a time sits on the 6 AM–10 PM timeline, 0 to 100. */
const onLine = (minutes: number) =>
  Math.min(Math.max(((minutes - DAY_START) / (DAY_END - DAY_START)) * 100, 0), 100);

const supportActions: Record<string, string> = {
  Phone: 'Call',
  Email: 'Email',
  'Facebook / Messenger': 'Message',
};

export function ContactSection() {
  const [profile, setProfile] = useState(getPharmacyContact);
  const [now, setNow] = useState(() => new Date());
  /** The week set in Settings › Opening hours; the usual hours until the server answers. */
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursEntry[]>(defaultHours);

  useEffect(() => {
    const sync = () => setProfile(getPharmacyContact());
    sync();
    // Read without a login, so every visitor sees the owner's details and hours.
    getPublicSettings()
      .then((store) => {
        if (store.openingHours) setWeeklyHours(store.openingHours);
        setProfile((current) => ({
          ...current,
          name: store.name || current.name,
          address: store.address || current.address,
          phone: store.phone || current.phone,
          email: store.email || current.email,
        }));
      })
      .catch(() => {});
    window.addEventListener('storage', sync);
    window.addEventListener('pharmacy-settings-changed', sync);
    // Open or closed, and the "now" mark, follow the clock.
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pharmacy-settings-changed', sync);
      window.clearInterval(tick);
    };
  }, []);

  const status = getPharmacyStatus(now, weeklyHours, pharmacyProfile.timezone);
  const today = weeklyHours.find((entry) => entry.day === status.currentDay);
  const nowMinutes = storeMinutes(now);
  const nowLabel = formatTime(
    `${Math.floor(nowMinutes / 60)}:${String(nowMinutes % 60).padStart(2, '0')}`,
  );
  // The cashier picked when this device started the shift; nothing is shown otherwise.
  const onDuty = getSession()?.cashierName;
  // Monday first, as a week is read at the counter.
  const week = [...weeklyHours].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));

  // Only details the owner has filled in under Settings are shown.
  const pharmacyRows = [
    { label: 'Address', value: profile.address },
    { label: 'Phone', value: profile.phone },
    { label: 'Email', value: profile.email },
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
          {/* The store's sign: open or closed, today on a timeline, and the week. */}
          <article className={`store-sign${status.isOpen ? ' is-open' : ''}`}>
            <span className="store-sign__band" aria-hidden="true" />
            <p className="store-sign__name">{profile.name}</p>
            <p className="store-sign__state">
              <span className="store-sign__lamp" aria-hidden="true" />
              {status.isOpen ? 'Open' : 'Closed'}
            </p>
            <p className="store-sign__next">
              {status.nextChange}
              {onDuty && (
                <>
                  {' · '}On duty <strong>{onDuty}</strong>
                </>
              )}
            </p>

            <div className="store-day" aria-label={`Today: ${status.nextChange}`}>
              <div className="store-day__line">
                {today?.opensAt && today.closesAt && (
                  <span
                    className="store-day__open"
                    style={{
                      left: `${onLine(toMinutes(today.opensAt))}%`,
                      right: `${100 - onLine(toMinutes(today.closesAt))}%`,
                    }}
                  />
                )}
                <span
                  className={`store-day__now${
                    onLine(nowMinutes) < 15 ? ' is-start' : onLine(nowMinutes) > 85 ? ' is-end' : ''
                  }`}
                  style={{ '--at': `${onLine(nowMinutes)}%` } as CSSProperties}
                >
                  <b>Now {nowLabel}</b>
                </span>
              </div>
              <div className="store-day__ticks" aria-hidden="true">
                <span>6 AM</span>
                <span>12 NN</span>
                <span>6 PM</span>
                <span>10 PM</span>
              </div>
            </div>

            <ul className="store-week" aria-label="Opening hours this week">
              {week.map((entry) => {
                const open = entry.opensAt && entry.closesAt;
                const isToday = entry.day === status.currentDay;
                return (
                  <li
                    key={entry.day}
                    className={isToday ? 'is-today' : undefined}
                    aria-label={`${entry.label}: ${
                      open
                        ? `${formatTime(entry.opensAt!)} to ${formatTime(entry.closesAt!)}`
                        : 'closed'
                    }`}
                  >
                    <span className="store-week__day" aria-hidden="true">
                      {entry.label.slice(0, 3)}
                    </span>
                    <span className="store-week__track" aria-hidden="true">
                      {open && (
                        <i
                          style={{
                            top: `${onLine(toMinutes(entry.opensAt!))}%`,
                            bottom: `${100 - onLine(toMinutes(entry.closesAt!))}%`,
                          }}
                        />
                      )}
                    </span>
                    <span className="store-week__hours" aria-hidden="true">
                      {open
                        ? `${formatTime(entry.opensAt!, true)}–${formatTime(entry.closesAt!, true)}`
                        : 'Closed'}
                    </span>
                  </li>
                );
              })}
            </ul>

            {pharmacyRows.length > 0 && (
              <dl className="store-sign__facts">
                {pharmacyRows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>

          {/* System support: the developer, then one large row per way to reach him. */}
          <article className="support-card">
            <header className="support-card__head">
              <img src={developerPhoto} alt="" className="support-card__photo" />
              <div>
                <h3>System support</h3>
                <p>
                  {developerProfile.name}, {developerProfile.role.toLowerCase()}
                </p>
              </div>
            </header>
            <p className="support-card__note">
              Trouble logging in, a stock or sales question, or something new for the system.
            </p>
            <div className="support-links">
              {developerProfile.contacts.map((contact) => {
                const external = contact.href.startsWith('http');
                const isFacebook = contact.label === 'Facebook / Messenger';
                return (
                  <a
                    className="support-link"
                    key={contact.label}
                    href={contact.href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noreferrer' : undefined}
                  >
                    <span className="support-link__text">
                      <small>{isFacebook ? 'Messenger' : contact.label}</small>
                      <span>
                        {isFacebook && (
                          <svg className="support-link__fb" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="#0866FF"
                              d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                            />
                            <path
                              fill="#fff"
                              d="m16.671 15.543.532-3.47h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.513V4.996s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.642H7.078v3.47h3.047v8.385a12.09 12.09 0 0 0 3.75 0v-8.385z"
                            />
                          </svg>
                        )}
                        {contact.value}
                      </span>
                    </span>
                    <span className="support-link__action">
                      {supportActions[contact.label] ?? 'Open'}
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
                      </svg>
                    </span>
                  </a>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
