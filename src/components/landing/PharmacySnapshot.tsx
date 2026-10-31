import type { PharmacyStatus } from './pharmacyTime';
import type { StaffMember, WeeklyHoursEntry } from './types';
import HomeIcon from './hovericons/home-icon';
import UsersGroupIcon from './hovericons/users-group-icon';

interface PharmacySnapshotProps {
  status: PharmacyStatus;
  staff: StaffMember[];
  hours: WeeklyHoursEntry[];
}

function formatTime(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2024, 0, 1, hours, minutes)));
}

export function PharmacySnapshot({ status, staff, hours }: PharmacySnapshotProps) {
  return (
    <div className="visit-details" aria-label="Pharmacy information">
      <article className="visit-card visit-card--status">
        <div className="visit-card__heading">
          <span className="visit-card__icon" aria-hidden="true">
            <HomeIcon size={21} color="currentColor" strokeWidth={1.8} />
          </span>
          <h3>Store status</h3>
        </div>
        <p className="visit-card__primary">
          <span
            className={`visit-status-dot${status.isOpen ? ' is-open' : ''}`}
            aria-hidden="true"
          />
          {status.message}
        </p>
        <p className="visit-card__secondary">{status.nextChange}</p>
      </article>

      <article className="visit-card visit-card--team">
        <div className="visit-card__heading">
          <span className="visit-card__icon" aria-hidden="true">
            <UsersGroupIcon size={21} color="currentColor" strokeWidth={1.8} />
          </span>
          <h3>On duty today</h3>
        </div>
        <ul className="visit-team">
          {staff.map((person) => (
            <li key={person.role}>
              <span>{person.role}</span>
              <strong>{person.displayName}</strong>
            </li>
          ))}
        </ul>
      </article>

      <section className="visit-schedule" aria-labelledby="visit-schedule-title">
        <div className="visit-schedule__heading">
          <div>
            <p className="eyebrow">Opening hours</p>
            <h3 id="visit-schedule-title">This week at Dagohoy</h3>
          </div>
          <span>Times shown in Philippine time</span>
        </div>
        <ul className="visit-week">
          {hours.map((entry) => {
            const isToday = entry.day === status.currentDay;
            const schedule =
              entry.opensAt && entry.closesAt
                ? `${formatTime(entry.opensAt)} – ${formatTime(entry.closesAt)}`
                : 'Closed';
            return (
              <li className={isToday ? 'visit-day is-today' : 'visit-day'} key={entry.day}>
                <span className="visit-day__name">{entry.label}</span>
                <strong>{schedule}</strong>
                {isToday && <span className="visit-day__today">Today</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
