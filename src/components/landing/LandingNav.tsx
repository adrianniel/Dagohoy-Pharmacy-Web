import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function LandingNav() {
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  /** Phone only: the three links stay behind the menu button until it is tapped. */
  const [menuOpen, setMenuOpen] = useState(false);

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

  // An open menu closes on Escape or a tap anywhere outside the header.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    const onTap = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onTap);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onTap);
    };
  }, [menuOpen]);

  return (
    <header className="landing-nav-wrap" ref={headerRef}>
      <nav className={`landing-nav${menuOpen ? ' is-menu-open' : ''}`} aria-label="Main navigation">
        <BrandMark />
        <div className="landing-nav__links" id="landing-nav-links">
          <a href="#home" onClick={() => setMenuOpen(false)}>
            Home
          </a>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>
            Contact
          </a>
        </div>
        <Link className="landing-nav__login" to="/login" state={{ backgroundLocation: location }}>
          Log in
        </Link>
        <button
          className="landing-nav__menu"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="landing-nav-links"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </nav>
    </header>
  );
}
