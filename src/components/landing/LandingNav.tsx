import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function LandingNav() {
  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label="Main navigation">
        <BrandMark />
        <div className="landing-nav__links">
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
        <Link className="landing-nav__login" to="/login">
          Staff sign in <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}
