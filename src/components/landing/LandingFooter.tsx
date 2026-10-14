import { BrandMark } from './BrandMark';
import { pharmacyProfile } from './mockData';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__inner">
        <BrandMark />
        <p>
          © {new Date().getFullYear()} {pharmacyProfile.name}. For the community, every day.
        </p>
      </div>
    </footer>
  );
}
