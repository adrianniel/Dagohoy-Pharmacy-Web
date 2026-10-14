import { pharmacyFeatures } from './mockData';

export function FeaturesSection() {
  return (
    <section
      className="features-section section-wrap"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <h2 id="features-title">One system, built around pharmacy work.</h2>
        <p>Simple tools for everyday service and more careful stock handling.</p>
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
