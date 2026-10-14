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

export function PharmacySnapshot({ status, staff, hours }: PharmacySnapshotProps) {
  return (
    <section className="snapshot" aria-label="Pharmacy information">
      <article className="snapshot__status">
        <div className="snapshot__status-heading">
          <p className="eyebrow">Pharmacy status</p>
          <span
            className={`status-light${status.isOpen ? ' status-light--open' : ''}`}
            aria-hidden="true"
          />
        </div>
        <h2>{status.message}</h2>
        <p className="snapshot__muted">{status.nextChange}</p>
        <p className="snapshot__note">Calculated from sample local hours.</p>
      </article>

      <article className="snapshot__staff">
        <p className="eyebrow">
          On duty today <span className="sample-label">Sample roster</span>
        </p>
        <div className="staff-list">
          {staff.map((person) => (
            <div className="staff-row" key={person.role}>
              <span className="staff-initials" aria-hidden="true">
                {person.initials}
              </span>
              <span className="staff-row__copy">
                <strong>{person.role}</strong>
                <span>{person.displayName}</span>
              </span>
            </div>
          ))}
        </div>
      </article>

      <article className="snapshot__hours">
        <div className="hours-heading">
          <p className="eyebrow">Weekly hours</p>
          <span className="sample-label">Sample schedule</span>
        </div>
        <ul className="hours-list">
          {hours.map((entry) => {
            const isToday = entry.day === status.currentDay;
            const schedule =
              entry.opensAt && entry.closesAt
                ? `${formatTime(entry.opensAt)} - ${formatTime(entry.closesAt)}`
                : 'Closed';

            return (
              <li className={isToday ? 'hours-row hours-row--today' : 'hours-row'} key={entry.day}>
                <span>{entry.label}</span>
                <span>{schedule}</span>
                {isToday && <span className="today-label">Today</span>}
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
