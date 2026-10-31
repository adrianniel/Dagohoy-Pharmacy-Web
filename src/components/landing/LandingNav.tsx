import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function LandingNav() {
  const location = useLocation();

  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label="Main navigation">
        <BrandMark />
        <div className="landing-nav__links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </div>
        <Link className="landing-nav__login" to="/login" state={{ backgroundLocation: location }}>
          Login
        </Link>
      </nav>
    </header>
  );
}
