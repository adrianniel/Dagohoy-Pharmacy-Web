import { developerProfile } from './mockData';
import { BusinessStarfield } from './BusinessStarfield';

export function DeveloperCta() {
  return (
    <div className="developer-section-wall">
      <section className="developer-section section-wrap" aria-labelledby="developer-title">
        <BusinessStarfield />
        <div className="developer-section__copy">
          <p className="eyebrow">For your business</p>
          <h2 id="developer-title">Need a System for Your Business?</h2>
          <p>
            Looking for a POS, inventory system, or custom web application tailored to your business
            operations? Let&apos;s build a system around how your business actually works.
          </p>
          <a
            className="action-link developer-section__contact"
            href={`mailto:${developerProfile.email}`}
          >
            Let&apos;s Connect <span aria-hidden="true">↗</span>
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
