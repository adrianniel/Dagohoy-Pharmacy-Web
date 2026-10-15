import { pharmacyFeatures } from './mockData';

export function FeaturesSection() {
  return (
    <section
      className="features-section section-wrap"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <h2 id="features-title">Tools for everyday pharmacy work.</h2>
        <p>A practical foundation for the day-to-day work behind great service.</p>
      </div>
      <div className="features-grid">
        {pharmacyFeatures.map((feature) => (
          <article className={`feature-panel ${feature.className}`} key={feature.number}>
            <span className="feature-panel__number">{feature.number}</span>
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
