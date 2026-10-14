import { Link } from 'react-router-dom';

export function BrandMark() {
  return (
    <Link className="landing-brand" to="/" aria-label="Dagohoy Pharmacy home">
      <span className="landing-brand__mark" aria-hidden="true">
        D
      </span>
      <span className="landing-brand__text">
        <strong>Dagohoy</strong>
        <span>PHARMACY</span>
      </span>
    </Link>
  );
}
