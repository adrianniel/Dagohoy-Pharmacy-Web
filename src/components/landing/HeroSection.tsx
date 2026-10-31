import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import { Link, useLocation } from 'react-router-dom';
import { PharmacySnapshot } from './PharmacySnapshot';
import type { PharmacyStatus } from './pharmacyTime';
import type { StaffMember, WeeklyHoursEntry } from './types';

interface HeroSectionProps {
  status: PharmacyStatus;
  staff: StaffMember[];
  hours: WeeklyHoursEntry[];
}

export function HeroSection({ status, staff, hours }: HeroSectionProps) {
  const location = useLocation();

  return (
    <section className="landing-hero" id="home" aria-labelledby="landing-title">
      <div className="landing-hero__stage">
        <div className="landing-hero__copy">
          <p className="landing-hero__eyebrow">Dagohoy Pharmacy · Bohol</p>
          <h1 id="landing-title">
            Better care starts <em>behind the counter.</em>
          </h1>
          <p className="landing-hero__description">
            A calmer way to manage sales, stock, and everyday pharmacy work—so there’s more room to
            focus on your community.
          </p>
          <div className="hero-actions">
            <Link className="action-link" to="/login" state={{ backgroundLocation: location }}>
              Open staff workspace <span aria-hidden="true">→</span>
            </Link>
            <a className="action-link action-link--outline" href="#features">
              Explore the system
            </a>
          </div>
        </div>
        <figure className="landing-hero__visual">
          <img
            className="landing-hero__image"
            src={storefrontImage}
            alt="Dagohoy Pharmacy storefront"
            width="1500"
            height="842"
            fetchPriority="high"
          />
          <figcaption className="landing-hero__photo-credit">Dagohoy Pharmacy · Bohol</figcaption>
        </figure>
        <div className="landing-hero__highlights" aria-label="System highlights">
          <div>
            <span className="landing-highlight-icon" aria-hidden="true">
              ✳
            </span>
            <span>
              <strong>At the counter</strong>
              <small>Barcode-ready sales</small>
            </span>
          </div>
          <div>
            <span className="landing-highlight-icon" aria-hidden="true">
              ▦
            </span>
            <span>
              <strong>Behind the scenes</strong>
              <small>Stock &amp; expiry tracking</small>
            </span>
          </div>
          <div>
            <span className="landing-highlight-icon" aria-hidden="true">
              ↗
            </span>
            <span>
              <strong>Every day</strong>
              <small>Clear operational reports</small>
            </span>
          </div>
        </div>
      </div>
      <div className="landing-pharmacy-overview">
        <div className="landing-overview-heading">
          <p className="eyebrow">At a glance</p>
          <h2>Plan your visit</h2>
          <p>Opening hours and the team on duty.</p>
        </div>
        <PharmacySnapshot status={status} staff={staff} hours={hours} />
      </div>
    </section>
  );
}
