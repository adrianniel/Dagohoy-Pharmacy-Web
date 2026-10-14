import { pharmacyProfile } from './mockData';

export function AboutSection() {
  return (
    <section className="about-section section-wrap" id="about" aria-labelledby="about-title">
      <p className="about-section__label">Rooted in care</p>
      <div className="about-section__content">
        <h2 id="about-title">A local pharmacy, made easier to run.</h2>
        <p>
          {pharmacyProfile.name} serves its community with a team-first approach. This system is
          being shaped to make daily pharmacy operations clearer while keeping people and careful
          service at the center.
        </p>
      </div>
    </section>
  );
}
