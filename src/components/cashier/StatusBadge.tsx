interface StatusBadgeProps {
  value: string;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const slug = value.toLowerCase().replaceAll(' ', '-');
  return <span className={`cashier-status cashier-status--${slug}`}>{value}</span>;
}
