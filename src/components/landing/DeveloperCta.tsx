import { developerProfile } from './mockData';

export function DeveloperCta() {
  return (
    <section className="developer-section section-wrap" aria-labelledby="developer-title">
      <div className="developer-section__copy">
        <p className="eyebrow">Built with care</p>
        <h2 id="developer-title">A system shaped around the people who use it.</h2>
        <p>
          Designed and developed by {developerProfile.name}, {developerProfile.role.toLowerCase()}.
        </p>
      </div>
      <div className="developer-section__services" aria-label="Developer services">
        {developerProfile.services.map((service) => (
          <span key={service}>{service}</span>
        ))}
      </div>
      <a className="developer-section__contact" href={`mailto:${developerProfile.email}`}>
        Contact the developer <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
