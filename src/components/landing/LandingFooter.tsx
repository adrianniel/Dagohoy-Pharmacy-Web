import { BrandMark } from './BrandMark';
import { pharmacyProfile } from './content';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__inner">
        <div className="footer-brand">
          <BrandMark />
          <span>POS &amp; Inventory Management System</span>
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
