import { pharmacyProfile } from './mockData';

export function ContactSection() {
  return (
    <section className="contact-section section-wrap" id="contact" aria-labelledby="contact-title">
      <div>
        <h2 id="contact-title">Visit or get in touch.</h2>
        <p>For pharmacy questions, reach the team using the contact details below.</p>
      </div>
      <address className="contact-details">
        <span>{pharmacyProfile.address}</span>
        <span>{pharmacyProfile.phone}</span>
        <span>{pharmacyProfile.email}</span>
      </address>
    </section>
  );
}
