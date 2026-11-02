import posImage from '../../assets/POS element.png';

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
          d="M607 0H2000V860L641 220Q607 202 607 170Z"
        />
        <path
          className="landing-hero__green-shape-mobile"
          d="M1050 0H2000V460L1400 325Q1050 260 1050 150Z"
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
          <a className="landing-hero__cta" href="#contact">
            Get Your Own System
          </a>
        </header>
        <img
          className="landing-hero__pos-image"
          src={posImage}
          alt="Pharmacy point-of-sale system with touchscreen, cash drawer, barcode scanner, and receipt printer"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
