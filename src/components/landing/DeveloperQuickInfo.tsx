import { useId, useState } from 'react';
import type { StaffMember, WeeklyHoursEntry } from './types';

interface DeveloperQuickInfoProps {
  hours: WeeklyHoursEntry[];
  onDuty?: StaffMember;
}

function formatTime(value: string) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function DeveloperQuickInfo({ hours, onDuty }: DeveloperQuickInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();

  return (
    <div className="developer-quickbar">
      <div className={`developer-hours-dropdown${isOpen ? ' is-open' : ''}`}>
        <button
          className="developer-hours-trigger"
          type="button"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>Opening Hours</span>
        </button>
        <ul className="developer-hours-list" id={listId} aria-hidden={!isOpen}>
          {hours.map((entry) => (
            <li className="developer-hours-item" key={entry.day}>
              <article className="developer-hours-article">
                <span>{entry.label}</span>
                <strong>
                  {entry.opensAt && entry.closesAt
                    ? `${formatTime(entry.opensAt)} – ${formatTime(entry.closesAt)}`
                    : 'Closed'}
                </strong>
              </article>
            </li>
          ))}
        </ul>
      </div>
      <div className="developer-onduty">
        <span className="developer-onduty__label">ON DUTY:</span>
        {onDuty && (
          <strong className="developer-onduty__name" title={onDuty.displayName}>
            {onDuty.displayName}
          </strong>
        )}
      </div>
    </div>
  );
}
