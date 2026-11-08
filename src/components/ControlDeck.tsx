import type { ReactNode } from 'react';
import { CashierIcon } from './cashier/CashierIcon';

/*
 * The control buttons at the top of a page, and the card under them that shows
 * what the pressed button opens. Every section uses the same pair, so moving
 * between pages feels the same: pick a task on top, work on it below.
 */

export type ControlTone = 'forest' | 'green' | 'blue' | 'amber' | 'slate' | 'teal' | 'rose' | 'red';

export type ControlItem<Key extends string> = {
  key: Key;
  icon: Parameters<typeof CashierIcon>[0]['name'];
  title: string;
  hint: string;
  tone: ControlTone;
  /** A live number shown in the corner, e.g. how many need attention. */
  count?: number | string;
  /** Highlight the count: something here needs doing. */
  alert?: boolean;
  /** One sentence shown at the top of the result card. */
  about?: string;
};

type ControlDeckProps<Key extends string> = {
  /** Used for element ids, so two decks never clash. */
  id: string;
  title: string;
  subtitle?: string;
  items: Array<ControlItem<Key>>;
  active: Key;
  onSelect: (key: Key) => void;
  /** Optional badge or button at the right of the heading. */
  aside?: ReactNode;
};

export function ControlDeck<Key extends string>({
  id,
  title,
  subtitle,
  items,
  active,
  onSelect,
  aside,
}: ControlDeckProps<Key>) {
  return (
    <section className="control-deck" aria-labelledby={`${id}-title`}>
      <div className="control-deck__head">
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {aside}
      </div>
      <div
        className={`control-deck__grid control-deck__grid--${Math.min(items.length, 4)}`}
        role="tablist"
        aria-label={title}
      >
        {items.map((item) => (
          <button
            key={item.key}
            id={`${id}-tab-${item.key}`}
            className={`control-deck__key${active === item.key ? ' is-active' : ''}${
              item.alert ? ' has-alert' : ''
            }`}
            data-tone={item.tone}
            type="button"
            role="tab"
            aria-selected={active === item.key}
            aria-controls={`${id}-panel`}
            onClick={() => onSelect(item.key)}
          >
            {item.count !== undefined && <b className="control-deck__count">{item.count}</b>}
            <span className="control-deck__icon" aria-hidden="true">
              <CashierIcon name={item.icon} />
            </span>
            <strong>{item.title}</strong>
            <small>{item.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

type ControlPanelProps = {
  /** Same id as the ControlDeck it belongs to. */
  id: string;
  /** The key of the open button, so the card replays its entrance when it changes. */
  activeKey: string;
  title: string;
  about?: string;
  /** Optional buttons at the right of the card heading. */
  actions?: ReactNode;
  children: ReactNode;
};

export function ControlPanel({
  id,
  activeKey,
  title,
  about,
  actions,
  children,
}: ControlPanelProps) {
  return (
    <section
      id={`${id}-panel`}
      className="control-panel"
      role="tabpanel"
      aria-labelledby={`${id}-tab-${activeKey}`}
      key={activeKey}
    >
      <div className="control-panel__head">
        <div>
          <h4>{title}</h4>
          {about && <p>{about}</p>}
        </div>
        {actions && <div className="control-panel__actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
