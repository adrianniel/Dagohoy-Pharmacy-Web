import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import { pharmacyProfile } from './mockData';

export function HeroSection() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__copy">
        <p className="landing-hero__eyebrow">Dagohoy Pharmacy</p>
        <h1 id="landing-title">Clear tools for pharmacy teams.</h1>
        <p className="landing-hero__description">
          Point of sale and inventory support for Dagohoy Pharmacy&apos;s everyday community
          service.
        </p>
        <a className="action-link" href="#features">
          Explore the system <span aria-hidden="true">↗</span>
        </a>
      </div>
      <figure className="landing-hero__image-wrap">
        <img
          className="landing-hero__image"
          src={storefrontImage}
          alt={`${pharmacyProfile.name} storefront`}
          fetchPriority="high"
        />
      </figure>
    </section>
  );
}
