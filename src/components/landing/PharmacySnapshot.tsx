import type { PharmacyStatus } from './pharmacyTime';
import type { StaffMember, WeeklyHoursEntry } from './types';

interface PharmacySnapshotProps {
  status: PharmacyStatus;
  staff: StaffMember[];
  hours: WeeklyHoursEntry[];
}

function formatTime(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2024, 0, 1, hours, minutes)));
}

function formatCompactTime(value: string) {
  return formatTime(value).replace(':00', '').replace(' AM', 'AM').replace(' PM', 'PM');
}

export function PharmacySnapshot({ status, staff, hours }: PharmacySnapshotProps) {
  return (
    <section className="snapshot" aria-label="Pharmacy information">
      <div className="snapshot__overview">
        <article className="snapshot__status">
          <span className="snapshot-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="m5 12 2-6h18l2 6" />
              <path d="M4 12h24v4a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-4-2z" />
              <path d="M6 17v11h20V17M12 28v-8h8v8" />
            </svg>
          </span>
          <div className="snapshot__status-heading">
            <span
              className={`status-light${status.isOpen ? ' status-light--open' : ''}`}
              aria-hidden="true"
            />
            <span className="snapshot__status-copy">
              <strong>{status.message}</strong>
              <small>{status.nextChange}</small>
            </span>
          </div>
        </article>

        <article className="snapshot__staff">
          <span className="snapshot-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <circle cx="12" cy="10" r="4" />
              <circle cx="23" cy="13" r="3" />
              <path d="M4 27c0-5 3-9 8-9s8 4 8 9H4z" />
              <path d="M19 20c4-2 9 1 9 7h-6" />
            </svg>
          </span>
          <div className="snapshot__staff-content">
            <div className="snapshot-card-heading">
              <p className="eyebrow">On duty today</p>
            </div>
            <div className="staff-list">
              {staff.map((person) => (
                <div className="staff-row" key={person.role}>
                  <span className="staff-row__copy">
                    <strong>{person.role}</strong>
                    <span>{person.displayName}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <article className="snapshot__hours">
        <div className="snapshot-card-heading">
          <span className="snapshot-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <rect x="5" y="7" width="22" height="21" rx="2" />
              <path d="M10 4v6M22 4v6M5 13h22" />
            </svg>
          </span>
          <p className="eyebrow">Weekly hours</p>
        </div>
        <ul className="hours-list">
          {hours.map((entry) => {
            const isToday = entry.day === status.currentDay;
            const schedule =
              entry.opensAt && entry.closesAt
                ? `${formatTime(entry.opensAt)} – ${formatTime(entry.closesAt)}`
                : 'Closed';
            const compactSchedule =
              entry.opensAt && entry.closesAt
                ? `${formatCompactTime(entry.opensAt)}–${formatCompactTime(entry.closesAt)}`
                : 'Closed';

            return (
              <li className={isToday ? 'hours-row hours-row--today' : 'hours-row'} key={entry.day}>
                <span>{entry.label.slice(0, 3)}</span>
                <span title={`${entry.label}: ${schedule}`}>{compactSchedule}</span>
                {isToday && <span className="today-label">Today</span>}
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
