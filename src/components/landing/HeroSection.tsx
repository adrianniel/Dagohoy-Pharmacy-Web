import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import ChartBarIcon from './hovericons/chart-bar-icon';
import HomeIcon from './hovericons/home-icon';
import MapPinIcon from './hovericons/map-pin-icon';
import ScanBarcodeIcon from './hovericons/scan-barcode-icon';
import StackIcon from './hovericons/stack-icon';
import NeonGlowButton from '../originkit/ui/neon-glow-button';
import type { PharmacyStatus } from './pharmacyTime';
import type { StaffMember } from './types';

interface HeroSectionProps {
  status: PharmacyStatus;
  staff: StaffMember[];
}

export function HeroSection({ status, staff }: HeroSectionProps) {
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
              <MapPinIcon size={16} color="currentColor" strokeWidth={2} />
              <span>Dagohoy Public Market, Bohol</span>
            </figcaption>
          </figure>

          <aside className="landing-hero__side landing-hero__side--left">
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <HomeIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Built for Pharmacy Work</h2>
              <p>
                Keep daily pharmacy tasks organized
                <br />
                so staff can work efficiently
                <br />
                and focus on better service.
              </p>
            </article>
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <ScanBarcodeIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Scan and Go</h2>
              <p>
                Use barcode scanning to find products
                <br />
                faster, reduce manual input, and keep
                <br />
                transactions moving smoothly.
              </p>
            </article>
            <div className="landing-hero__duty" aria-label="Staff on duty">
              <strong>On Duty:</strong>
              <ul>
                {staff.map((person) => (
                  <li key={person.role}>
                    <span>{person.role}</span>
                    <b>{person.displayName}</b>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <aside className="landing-hero__side landing-hero__side--right">
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <StackIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Stock You Can Trust</h2>
              <p>
                Keep inventory, batches, and expiry
                <br />
                information organized so stock decisions
                <br />
                are based on clear records.
              </p>
            </article>
            <article className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden="true">
                <ChartBarIcon size={28} color="currentColor" strokeWidth={2} />
              </span>
              <h2>Clear Business Visibility</h2>
              <p>
                Give the owner a better view
                <br />
                of sales, inventory activity, and
                <br />
                daily operations in one system.
              </p>
            </article>
            <NeonGlowButton
              label="Get Your Own System"
              link="#contact"
              colors={{
                fill: '#102318',
                hoverFill: '#183d2a',
                textColor: '#fffdf1',
                hoverTextColor: '#d7f6c7',
              }}
              font={{
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 700,
                lineHeight: '1.2',
              }}
              padding="0.7rem 1rem"
              rounded={8}
              addIcon
              icon={{
                side: 'right',
                size: 16,
                symbol: '↗',
                color: '#cce8b7',
                hoverColor: '#fffdf1',
              }}
              border={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#cce8b7',
              }}
              glow={{ color: '#cce8b7', size: 5, blur: 8 }}
              style={{ minHeight: 42 }}
            />
          </aside>
        </div>
      </div>
    </section>
  );
}
