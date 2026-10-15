import type { ReactNode } from 'react';

interface CashierPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function CashierPageHeader({ eyebrow, title, description, action }: CashierPageHeaderProps) {
  return (
    <div className="cashier-page-heading">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}
