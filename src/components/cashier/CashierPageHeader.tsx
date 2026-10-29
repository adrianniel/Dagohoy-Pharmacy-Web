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
        <h2>{title}</h2>
        <span>{description}</span>
        <p className="cashier-page-context">{eyebrow}</p>
      </div>
      {action}
    </div>
  );
}
