import { pharmacyProfile } from './mockData';
import pharmacyMedicines from '../../assets/pharmacy-medicines.jpg';

export function AboutSection() {
  return (
    <section className="about-section section-wrap" id="about" aria-labelledby="about-title">
      <div className="about-section__image">
        <img
          src={pharmacyMedicines}
          alt="Illustrative close-up of medicines"
          loading="lazy"
          width="1000"
          height="667"
        />
        <span>Illustrative photo: Hal Gatewood / Unsplash</span>
      </div>
      <div className="about-section__content">
        <p className="eyebrow">Made for the work that matters</p>
        <h2 id="about-title">A little more clarity, every day.</h2>
        <p>
          The {pharmacyProfile.name} POS &amp; Inventory Management System brings sales, products,
          batches, and daily records into one workspace built for the pharmacy’s routine.
        </p>
        <ul className="about-section__pillars" aria-label="System coverage">
          <li>Sales operations</li>
          <li>Stock visibility</li>
          <li>Batch monitoring</li>
        </ul>
        <a className="about-section__link" href="#features">
          See what the system does <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
