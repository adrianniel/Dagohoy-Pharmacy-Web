import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function LandingNav() {
  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label="Main navigation">
        <BrandMark />
        <div className="landing-nav__links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
        <Link className="landing-nav__login" to="/login">
          <span className="login-icon" aria-hidden="true">
            {'\u25CF'}
          </span>{' '}
          Staff login
        </Link>
      </nav>
    </header>
  );
}
