interface CartIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export default function CartIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  className = '',
}: CartIconProps) {
  const classes = ['cart-icon', className].filter(Boolean).join(' ');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={classes}
      aria-hidden="true"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <circle className="cart-wheel cart-wheel-left" cx="6" cy="19" r="2" />
      <circle className="cart-wheel cart-wheel-right" cx="17" cy="19" r="2" />
      <path d="M17 17h-11v-14h-2" />
      <path d="M6 5l14 1l-1 7h-13" />
    </svg>
  );
}
