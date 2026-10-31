import { Link } from 'react-router-dom';
import type { MouseEventHandler } from 'react';
import pharmacyLogo from '../../assets/logo.png';

export function BrandMark({ onExpand }: { onExpand?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link
      className="landing-brand"
      to="/"
      onClick={onExpand}
      aria-label={onExpand ? 'Expand navigation' : 'Dagohoy Pharmacy home'}
      aria-expanded={onExpand ? false : undefined}
    >
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
