import type { WeeklyHoursEntry } from './types';

export interface PharmacyStatus {
  currentDay: number;
  isOpen: boolean;
  message: string;
  nextChange: string;
}

function getManilaTime(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Monday';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const currentDay =
    (
      {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      } satisfies Record<string, number>
    )[weekday] ?? 1;

  return { currentDay, minuteOfDay: hour * 60 + minute };
}

function toMinuteOfDay(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
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

export function getPharmacyStatus(
  now: Date,
  hours: WeeklyHoursEntry[],
  timeZone: string,
): PharmacyStatus {
  const { currentDay, minuteOfDay } = getManilaTime(now, timeZone);
  const today = hours.find((entry) => entry.day === currentDay);

  if (today?.opensAt && today.closesAt) {
    const opensAt = toMinuteOfDay(today.opensAt);
    const closesAt = toMinuteOfDay(today.closesAt);

    if (minuteOfDay >= opensAt && minuteOfDay < closesAt) {
      return {
        currentDay,
        isOpen: true,
        message: 'Open now',
        nextChange: `Open until ${formatTime(today.closesAt)}`,
      };
    }

    if (minuteOfDay < opensAt) {
      return {
        currentDay,
        isOpen: false,
        message: 'Closed right now',
        nextChange: `Opens today at ${formatTime(today.opensAt)}`,
      };
    }
  }

  const nextDay = [...hours]
    .filter((entry) => entry.opensAt)
    .map((entry) => ({
      ...entry,
      daysAhead: (entry.day - currentDay + 7) % 7 || 7,
    }))
    .sort((first, second) => first.daysAhead - second.daysAhead)[0];

  return {
    currentDay,
    isOpen: false,
    message: 'Closed right now',
    nextChange:
      nextDay?.opensAt && nextDay.daysAhead === 1
        ? `Opens tomorrow at ${formatTime(nextDay.opensAt)}`
        : nextDay?.opensAt
          ? `Opens ${nextDay.label} at ${formatTime(nextDay.opensAt)}`
          : 'Check back for updated hours',
  };
}
