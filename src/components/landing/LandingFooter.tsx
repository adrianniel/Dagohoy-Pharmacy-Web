import { BrandMark } from './BrandMark';
import { pharmacyProfile } from './content';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__inner">
        <div className="footer-brand">
          <BrandMark />
          <span>Inventory &amp; Sales Record System</span>
        </div>
        <p>
          <span>
            © {new Date().getFullYear()} {pharmacyProfile.name}
          </span>
          <span>Designed &amp; Developed by Niel Adrian Garig</span>
        </p>
      </div>
    </footer>
  );
}
