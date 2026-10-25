import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import { Link } from 'react-router-dom';
import { pharmacyProfile } from './mockData';
import { PharmacySnapshot } from './PharmacySnapshot';
import type { PharmacyStatus } from './pharmacyTime';
import type { StaffMember, WeeklyHoursEntry } from './types';

interface HeroSectionProps {
  status: PharmacyStatus;
  staff: StaffMember[];
  hours: WeeklyHoursEntry[];
}

export function HeroSection({ status, staff, hours }: HeroSectionProps) {
  return (
    <section className="landing-hero" id="home" aria-labelledby="landing-title">
      <div className="landing-hero__copy">
        <p className="landing-hero__eyebrow">
          <span className="hero-eyebrow-dot" /> Internal pharmacy operations platform
        </p>
        <h1 id="landing-title">
          <span>Dagohoy</span>
          <span>Pharmacy</span>
        </h1>
        <p className="landing-hero__subtitle">POS &amp; Inventory Management System</p>
        <p className="landing-hero__description">
          A focused workspace for sales, stock control, batch expiry, purchasing, and cash
          management—built for the people running Dagohoy Pharmacy every day.
        </p>
        <div className="hero-actions">
          <Link className="action-link" to="/login">
            <span className="action-icon action-icon--arrow" aria-hidden="true">
              ↗
            </span>{' '}
            Staff login
          </Link>
          <a className="action-link action-link--outline" href="#features">
            <span className="action-icon action-icon--bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>{' '}
            See capabilities
          </a>
        </div>
        <div className="landing-operations-strip" aria-label="System capabilities">
          <span>
            <b>POS</b> Barcode-ready checkout
          </span>
          <span>
            <b>Stock</b> Batch &amp; expiry tracking
          </span>
          <span>
            <b>Control</b> Cash drawer reconciliation
          </span>
        </div>
        <PharmacySnapshot status={status} staff={staff} hours={hours} />
      </div>
      <figure className="landing-hero__visual">
        <div className="landing-hero__image-wrap">
          <img
            className="landing-hero__image"
            src={storefrontImage}
            alt={`${pharmacyProfile.name} streetfront storefront`}
            fetchPriority="high"
          />
        </div>
        <figcaption className="hero-image-caption">
          <span className="hero-caption-mark" aria-hidden="true">
            D
          </span>
          <span>
            <strong>Dagohoy Pharmacy</strong>
            <small>Serving the community with care</small>
          </span>
          <span className="hero-caption-location">Local pharmacy</span>
        </figcaption>
      </figure>
    </section>
  );
}
