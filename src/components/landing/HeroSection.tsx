import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import { Link, useLocation } from 'react-router-dom';
import type { PharmacyStatus } from './pharmacyTime';

interface HeroSectionProps {
  status: PharmacyStatus;
}

export function HeroSection({ status }: HeroSectionProps) {
  const location = useLocation();

  return (
    <section className="landing-hero" id="home" aria-labelledby="landing-title">
      <div className="landing-hero__stage">
        <header className="landing-hero__intro">
          <h1 id="landing-title">
            <span className="landing-hero__headline-line">Better care starts</span>{' '}
            <span className="landing-hero__headline-accent">behind the counter.</span>
          </h1>
          <p className="landing-hero__description">
            Manage sales, stock, and everyday pharmacy work in one calm place, so you have more time
            for your community.
          </p>
        </header>

        <div className="landing-hero__showcase">
          <figure className="landing-hero__visual">
            <img
              className="landing-hero__image"
              src={storefrontImage}
              alt="Dagohoy Pharmacy storefront"
              width="1500"
              height="842"
              fetchPriority="high"
            />
            <span className={`landing-hero__status${status.isOpen ? ' is-open' : ''}`}>
              <span aria-hidden="true" />
              {status.isOpen ? 'Open' : 'Closed'}
            </span>
            <figcaption className="landing-hero__photo-credit">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22s8-7.1 8-13a8 8 0 1 0-16 0c0 5.9 8 13 8 13Z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <span className="landing-hero__photo-credit-copy">
                <strong>Hinungdan sa inyong kahimsug</strong>
                <span>Dagohoy Pharmacy, Bohol</span>
              </span>
            </figcaption>
          </figure>

          <aside className="landing-hero__side landing-hero__side--left">
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M13 35V27M24 35V19M35 35V12" />
                </svg>
              </span>
              <h2>Sales</h2>
              <p>Ring up customers fast and see the day’s totals as they build.</p>
            </article>
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="m24 7 16 9v17l-16 9-16-9V16l16-9Z" />
                  <path d="m8 16 16 9 16-9M24 25v17M16 12l16 9v8" />
                </svg>
              </span>
              <h2>Stock</h2>
              <p>Know what is on the shelf, what is low, and what expires soon.</p>
            </article>
            <Link
              className="landing-hero__action landing-hero__action--primary"
              to="/login"
              state={{ backgroundLocation: location }}
            >
              Open staff workspace
              <span aria-hidden="true">→</span>
            </Link>
          </aside>

          <aside className="landing-hero__side landing-hero__side--right">
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="12" width="32" height="29" rx="3" />
                  <path d="M15 7v10M33 7v10M8 21h32m-23 9 5 5 10-11" />
                </svg>
              </span>
              <h2>Daily work</h2>
              <p>Keep records tidy so end-of-day checks take minutes.</p>
            </article>
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="currentColor">
                  <circle cx="24" cy="15" r="7" />
                  <circle cx="10" cy="21" r="5" />
                  <circle cx="38" cy="21" r="5" />
                  <path d="M11 39c0-8 5-13 13-13s13 5 13 13v2H11v-2Zm-9 1c0-7 3-11 9-12 2 0 4 .5 5 1.5A16 16 0 0 0 13 40H2Zm32-9c1-1 3-1.5 5-1.5 6 1 9 5 9 12H35c0-4-1-8-3-10.5Z" />
                </svg>
              </span>
              <h2>Made for the shop</h2>
              <p>Simple screens your whole team can pick up on day one.</p>
            </article>
            <a className="landing-hero__action landing-hero__action--secondary" href="#contact">
              Need help getting in?
              <span aria-hidden="true">→</span>
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
