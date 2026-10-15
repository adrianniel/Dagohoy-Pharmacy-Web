import { pharmacyProfile } from './mockData';

export function AboutSection() {
  return (
    <section className="about-section section-wrap" id="about" aria-labelledby="about-title">
      <p className="about-section__label">Purpose-built for Dagohoy</p>
      <div className="about-section__content">
        <p className="eyebrow">About the system</p>
        <h2 id="about-title">About the System</h2>
        <p>
          The {pharmacyProfile.name} POS &amp; Inventory Management System is designed specifically
          for the daily workflow of the pharmacy, providing a centralized platform for sales,
          products, inventory, batches, and operational records.
        </p>
        <ul className="about-section__pillars" aria-label="System coverage">
          <li>Sales operations</li>
          <li>Stock visibility</li>
          <li>Batch monitoring</li>
        </ul>
      </div>
    </section>
  );
}
