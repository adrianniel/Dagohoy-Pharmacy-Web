import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import pharmacyLogo from '../../assets/logo.png';
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
          <span className="hero-eyebrow-dot" aria-hidden="true" /> Dagohoy Pharmacy · Bohol
        </p>
        <h1 id="landing-title">
          Care for the community. <em>Clarity behind the counter.</em>
        </h1>
        <p className="landing-hero__subtitle">A better way to run Dagohoy Pharmacy.</p>
        <p className="landing-hero__description">
          Sales, stock, and daily operations in one considered workspace—so your team can stay
          focused on the people who walk through the door.
        </p>
        <div className="hero-actions">
          <Link className="action-link" to="/login">
            <span className="action-icon action-icon--arrow" aria-hidden="true">
              ↗
            </span>{' '}
            Open staff workspace
          </Link>
          <a className="action-link action-link--outline" href="#features">
            <span className="action-icon action-icon--bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>{' '}
            Explore the system
          </a>
        </div>
      </div>
      <figure className="landing-hero__visual">
        <div className="landing-hero__image-wrap">
          <img
            className="landing-hero__image"
            src={storefrontImage}
            alt={`${pharmacyProfile.name} streetfront storefront`}
            width="1200"
            height="800"
            fetchPriority="high"
          />
        </div>
        <figcaption className="hero-image-caption">
          <img className="hero-caption-logo" src={pharmacyLogo} alt="" width="54" height="54" />
          <span>
            <strong>The neighborhood pharmacy</strong>
            <small>Built for the people we serve, every day.</small>
          </span>
        </figcaption>
      </figure>
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
