import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import { Link, useLocation } from 'react-router-dom';
import ChartBarIcon from './hovericons/chart-bar-icon';
import HomeIcon from './hovericons/home-icon';
import ScanBarcodeIcon from './hovericons/scan-barcode-icon';
import StackIcon from './hovericons/stack-icon';
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
            <span className="landing-hero__headline-line">Better care starts behind</span>
            <span>the counter.</span>
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
              <strong>Hinungdan sa inyong kahimsug</strong>
              <span>Dagohoy Pharmacy, Bohol</span>
            </figcaption>
          </figure>

          <aside className="landing-hero__side landing-hero__side--left">
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <HomeIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Built for Pharmacy Work</h2>
              <p>Made for daily pharmacy tasks, from counter work to inventory.</p>
            </article>
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <ScanBarcodeIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Scan and Go</h2>
              <p>Scan products faster, reduce manual input, and speed up checkout.</p>
            </article>
            <Link
              className="landing-hero__action landing-hero__action--primary"
              to="/login"
              state={{ backgroundLocation: location }}
            >
              Open staff workspace
            </Link>
          </aside>

          <aside className="landing-hero__side landing-hero__side--right">
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <StackIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Stock You Can Trust</h2>
              <p>
                Keep inventory, batches, and expiry information organized so stock decisions are
                based on clear records.
              </p>
            </article>
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <ChartBarIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Clear Business Visibility</h2>
              <p>
                Give the owner a better view of sales, inventory activity, and daily operations in
                one system.
              </p>
            </article>
            <a className="landing-hero__action landing-hero__action--secondary" href="#contact">
              Need help getting in?
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
