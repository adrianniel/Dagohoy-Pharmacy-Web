import { developerProfile } from './mockData';
import { BusinessStarfield } from './BusinessStarfield';

export function DeveloperCta() {
  return (
    <div className="developer-section-wall">
      <section className="developer-section section-wrap" aria-labelledby="developer-title">
        <BusinessStarfield />
        <div className="developer-section__copy">
          <p className="eyebrow" id="developer-title">
            For pharmacy owners
          </p>
          <p className="developer-section__message">
            Get a custom POS and inventory system built around your pharmacy’s daily workflow—from
            counter sales and barcode scanning to stock, batches, expiry dates, and staff
            operations.
          </p>
          <a
            className="action-link developer-section__contact"
            href={`mailto:${developerProfile.email}`}
          >
            Send a Message
          </a>
        </div>
        <div className="developer-section__profile">
          <p className="developer-section__label">Developed by</p>
          <h3>{developerProfile.name}</h3>
          <p className="developer-section__role">{developerProfile.role}</p>
          <ul className="developer-section__services" aria-label="Developer services">
            {developerProfile.services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
          <div className="developer-section__links">
            {developerProfile.contacts.map((contact) => (
              <a href={contact.href} key={contact.label}>
                <span>{contact.label} ↗</span>
                <small>{contact.value}</small>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
