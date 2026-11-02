import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function LandingNav() {
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const landingPage = header?.closest<HTMLElement>('.landing-page');
    if (!header || !landingPage) return;

    const updateHeight = () => {
      landingPage.style.setProperty('--landing-nav-height', `${header.offsetHeight}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      landingPage.style.removeProperty('--landing-nav-height');
    };
  }, []);

  return (
    <header className="landing-nav-wrap" ref={headerRef}>
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
