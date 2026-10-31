import { pharmacyFeatures } from './mockData';
import ChartBarIcon from './hovericons/chart-bar-icon';
import ShoppingCartIcon from './hovericons/shopping-cart-icon';
import StackIcon from './hovericons/stack-icon';

function FeatureIcon({ index }: { index: number }) {
  const icons = [ShoppingCartIcon, StackIcon, ChartBarIcon];
  const Icon = icons[index] ?? ShoppingCartIcon;

  return (
    <span className="feature-panel__icon" aria-hidden="true">
      <Icon size={30} color="currentColor" strokeWidth={2} />
    </span>
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
        <h2 id="features-title">Everything in its place. Nothing in your way.</h2>
        <p>Thoughtful tools for the moments that matter at the counter and beyond.</p>
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
