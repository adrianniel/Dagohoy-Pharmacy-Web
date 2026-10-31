import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function LandingNav() {
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <header className={`landing-nav-wrap${isCompact ? ' is-compact' : ''}`} ref={headerRef}>
      <nav className="landing-nav" aria-label="Main navigation">
        <BrandMark
          onExpand={
            isCompact
              ? (event) => {
                  event.preventDefault();
                  setIsCompact(false);
                }
              : undefined
          }
        />
        <div className="landing-nav__links" hidden={isCompact}>
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </div>
        <Link
          hidden={isCompact}
          className="landing-nav__login"
          to="/login"
          state={{ backgroundLocation: location }}
        >
          Login
        </Link>
      </nav>
    </header>
  );
}
