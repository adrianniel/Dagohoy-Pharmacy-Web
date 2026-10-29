import { Link } from 'react-router-dom';
import pharmacyLogo from '../../assets/logo.png';

export function BrandMark() {
  return (
    <Link className="landing-brand" to="/" aria-label="Dagohoy Pharmacy home">
      <img
        className="landing-brand__mark"
        src={pharmacyLogo}
        alt=""
        width="56"
        height="56"
        aria-hidden="true"
      />
      <span className="landing-brand__text">
        <strong>Dagohoy</strong>
        <span>PHARMACY</span>
      </span>
    </Link>
  );
}
