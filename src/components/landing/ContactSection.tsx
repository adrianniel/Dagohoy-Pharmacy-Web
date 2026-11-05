import { developerProfile, pharmacyProfile } from './mockData';

export function ContactSection() {
  return (
    <section className="contact-section section-wrap" id="contact" aria-labelledby="contact-title">
      <div className="contact-section__intro">
        <p className="eyebrow">Get in touch</p>
        <h2 id="contact-title">Contact &amp; support</h2>
        <p>Questions about the pharmacy or need help with the system? Reach the right team.</p>
      </div>
      <div className="contact-section__groups">
        <article className="contact-card">
          <h3>Dagohoy Pharmacy</h3>
          <address>
            <span>{pharmacyProfile.address}</span>
            <span>{pharmacyProfile.phone}</span>
            <span>{pharmacyProfile.businessHours}</span>
          </address>
        </article>
        <article className="contact-card">
          <h3>System Support</h3>
          <address>
            <span>{developerProfile.name}</span>
            <a href={`mailto:${developerProfile.email}`}>{developerProfile.email}</a>
            <a href="https://www.facebook.com/niel.adrn" target="_blank" rel="noreferrer">
              facebook.com/niel.adrn
            </a>
          </address>
        </article>
      </div>
    </section>
  );
}
