import { useState } from 'react';
import type { WeeklyHoursEntry } from './types';

interface OpeningHoursDisclosureProps {
  hours: WeeklyHoursEntry[];
}

function formatTime(value: string) {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function OpeningHoursDisclosure({ hours }: OpeningHoursDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="landing-opening-hours">
      <div
        className="landing-opening-hours__panel"
        id="landing-opening-hours-panel"
        hidden={!isOpen}
      >
        <p className="landing-opening-hours__heading">Weekly schedule</p>
        <ul>
          {hours.map((entry) => (
            <li key={entry.day}>
              <span>{entry.label}</span>
              <strong>
                {entry.opensAt && entry.closesAt
                  ? `${formatTime(entry.opensAt)} – ${formatTime(entry.closesAt)}`
                  : 'Closed'}
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <button
        className="landing-opening-hours__button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="landing-opening-hours-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        OPENING HOURS
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M3.204 10.803a.5.5 0 0 0 .707-.01L8 6.585l4.089 4.208a.5.5 0 1 0 .717-.697l-4.45-4.58a.5.5 0 0 0-.717 0l-4.45 4.58a.5.5 0 0 0 .015.707" />
        </svg>
      </button>
    </div>
  );
}
