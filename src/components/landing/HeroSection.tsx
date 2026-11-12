import type { CSSProperties } from 'react';
import posImage from '../../assets/POS element.png';

const ctaLabel = 'Get Your Own System';

export function HeroSection() {
  return (
    <section className="landing-hero" id="home" aria-labelledby="landing-title">
      <svg
        className="landing-hero__green-shape"
        viewBox="0 0 2000 1125"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="landing-hero__green-shape-desktop"
          d="M607 0H2000V970L641 220Q607 202 607 170Z"
        />
        <path
          className="landing-hero__green-shape-mobile"
          d="M800 0H2000V698L1023 490Q800 442 800 340Z"
        />
      </svg>
      <div className="landing-hero__stage">
        <header className="landing-hero__intro">
          <h1 id="landing-title">
            <span>Better care starts</span>
            <span>behind the counter.</span>
          </h1>
          <p className="landing-hero__description">
            One system to keep sales moving, stock visible, and daily pharmacy work under control.
          </p>
          <a className="landing-hero__cta" href="#contact" aria-label={ctaLabel}>
            <span className="landing-hero__cta-outline" aria-hidden="true" />
            <span className="landing-hero__cta-state">
              <svg
                className="landing-hero__cta-icon"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M14.22 21.63c-1.18 0-2.85-.83-4.17-4.8l-.72-2.16-2.16-.72C3.21 12.63 2.38 10.96 2.38 9.78c0-1.17.83-2.85 4.79-4.18l8.49-2.83c2.12-.71 3.89-.5 4.98.58 1.09 1.08 1.3 2.86.59 4.98l-2.83 8.49c-1.33 3.98-3 4.81-4.18 4.81ZM7.64 7.03C4.86 7.96 3.87 9.06 3.87 9.78s.99 1.82 3.77 2.74l2.52.84c.22.07.4.25.47.47l.84 2.52c.92 2.78 2.03 3.77 2.74 3.77s1.82-.99 2.75-3.77l2.83-8.49c.51-1.54.42-2.8-.23-3.45-.65-.65-1.91-.73-3.44-.22L7.64 7.03Z"
                  fill="currentColor"
                />
                <path
                  d="M10.11 14.4a.75.75 0 0 1-.53-1.28l3.58-3.59a.75.75 0 0 1 1.06 1.06l-3.58 3.59a.75.75 0 0 1-.53.22Z"
                  fill="currentColor"
                />
              </svg>
              <span className="landing-hero__cta-label" aria-hidden="true">
                {Array.from(ctaLabel).map((character, index) => (
                  <span
                    className="landing-hero__cta-letter"
                    key={`${character}-${index}`}
                    style={{ '--letter-index': index } as CSSProperties}
                  >
                    {character === ' ' ? '\u00a0' : character}
                  </span>
                ))}
              </span>
            </span>
          </a>
        </header>
        <img
          className="landing-hero__pos-image"
          src={posImage}
          alt="Pharmacy sales counter with touchscreen, cash drawer and barcode scanner"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
