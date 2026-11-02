import { useEffect } from 'react';

const revealTargets = [
  '.landing-hero__intro',
  '.landing-hero__visual',
  '.landing-hero__side',
  '.landing-hero__showcase > .landing-hero__visual',
  '.features-section .section-heading',
  '.features-workflow',
  '.developer-section__copy',
  '.developer-section__profile',
  '.contact-section__intro',
  '.contact-card',
  '.landing-footer__inner',
].join(', ');

export function useLandingScrollReveal() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.landing-page');
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = Array.from(page.querySelectorAll<HTMLElement>(revealTargets));
    if (!targets.length || !('IntersectionObserver' in window)) return;

    targets.forEach((target) => target.classList.add('scroll-reveal'));
    page.classList.add('has-scroll-reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-revealed', entry.isIntersecting);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
}
