import { pharmacyFeatures } from './mockData';

function FeatureIcon({ index }: { index: number }) {
  const icons = [
    <>
      <path d="M5 8h22v16H5z" />
      <path d="M9 13h8M9 18h5M22 12v8M19 16h6" />
    </>,
    <>
      <path d="m16 4 11 5-11 5L5 9z" />
      <path d="m5 15 11 5 11-5M5 21l11 5 11-5" />
    </>,
    <>
      <path d="M6 27V15M13 27V9M20 27V18M27 27V5" />
      <path d="M4 27h25" />
    </>,
  ];

  return (
    <svg className="feature-panel__icon" viewBox="0 0 32 32" aria-hidden="true">
      {icons[index]}
    </svg>
  );
}

export function FeaturesSection() {
  return (
    <section
      className="features-section section-wrap"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Core capabilities</p>
        <h2 id="features-title">One professional workspace for pharmacy operations.</h2>
        <p>
          Designed around the daily controls that keep sales accurate, stock traceable, and the
          counter moving.
        </p>
      </div>
      <div className="features-grid">
        {pharmacyFeatures.map((feature, index) => (
          <article className={`feature-panel ${feature.className}`} key={feature.number}>
            <div className="feature-panel__topline">
              <span className="feature-panel__number">{feature.number}</span>
              <FeatureIcon index={index} />
            </div>
            <div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
