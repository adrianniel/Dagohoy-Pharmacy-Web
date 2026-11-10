import developerPhoto from '../../assets/developer.jpg';
import { getSession } from '../../data/registerSession';
import { developerProfile, weeklyHours } from './content';
import { BusinessStarfield } from './BusinessStarfield';
import { DeveloperQuickInfo } from './DeveloperQuickInfo';

export function DeveloperCta() {
  const contacts = developerProfile.contacts;
  // The cashier picked when the shift was started; nobody is shown while the store is closed.
  const session = getSession();
  const onDuty = session
    ? {
        initials: session.cashierName.slice(0, 2).toUpperCase(),
        role: 'Cashier',
        displayName: session.cashierName,
      }
    : undefined;
  const emailContact = contacts.find((contact) => contact.label === 'Email');
  const facebookContact = contacts.find((contact) => contact.label === 'Facebook / Messenger');
  const githubContact = contacts.find((contact) => contact.label === 'GitHub');
  const emailHref = emailContact?.href ?? `mailto:${developerProfile.email}`;

  return (
    <div className="developer-section-wall">
      <DeveloperQuickInfo hours={weeklyHours} onDuty={onDuty} />
      <section className="developer-section section-wrap" aria-labelledby="developer-title">
        <BusinessStarfield />
        <div className="developer-section__copy">
          <p className="eyebrow" id="developer-title">
            For pharmacy owners
          </p>
          <p className="developer-section__message">
            Get a custom Inventory & Sales Record System built around your pharmacy’s daily
            workflow—from counter sales and barcode scanning to stock, batches, expiry dates, and
            staff operations.
          </p>
          <a
            className="action-link developer-section__contact"
            href={`mailto:${developerProfile.email}`}
          >
            Send a Message
          </a>
        </div>
        <div className="developer-section__profile">
          <div className="developer-card">
            <a
              className="developer-card__mail"
              href={emailHref}
              aria-label={`Email ${developerProfile.name}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </a>
            <div className="developer-card__profile-pic">
              <img src={developerPhoto} alt={developerProfile.name} />
            </div>
            <div className="developer-card__bottom">
              <div className="developer-card__content">
                <span className="developer-card__name">{developerProfile.name}</span>
                <span className="developer-card__about-me">
                  {developerProfile.role} building Inventory &amp; Sales Record Systems for
                  pharmacies.
                </span>
              </div>
              <div className="developer-card__bottom-bottom">
                <div className="developer-card__social-links">
                  <a href={emailHref} aria-label="Email">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </a>
                  <a
                    href={facebookContact?.href ?? '#'}
                    aria-label="Facebook / Messenger"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                  <a
                    href={githubContact?.href ?? '#'}
                    aria-label="GitHub"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <svg viewBox="0 0 496 512" aria-hidden="true">
                      <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
                    </svg>
                  </a>
                </div>
                <a className="developer-card__button" href={emailHref}>
                  Contact Me
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
