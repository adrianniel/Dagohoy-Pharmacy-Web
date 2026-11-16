import { useState } from 'react';

/*
 * One expiry date field for every form: Day · Month · Year, the same on every computer
 * (a browser date box follows the computer's own date setting). The value is 'YYYY-MM-DD',
 * '' when left blank, or UNFINISHED_EXPIRY while only part of it is filled in.
 * The day may be left blank: boxes often print only "EXP 03/2027", which means the month's end.
 */

export const UNFINISHED_EXPIRY = 'unfinished';
export const UNFINISHED_EXPIRY_MESSAGE =
  'Finish the expiry date: pick the month and type the year (the day may stay blank), or clear it.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type Parts = { day: string; month: string; year: string };
const pad = (n: number) => String(n).padStart(2, '0');

function partsOf(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? { day: String(Number(match[3])), month: String(Number(match[2])), year: match[1] }
    : { day: '', month: '', year: '' };
}

export function composeExpiry({ day, month, year }: Parts): string {
  if (!day && !month && !year) return '';
  // "27" is read as 2027.
  const fullYear = year.length === 2 ? 2000 + Number(year) : year.length === 4 ? Number(year) : 0;
  const monthNumber = Number(month);
  if (fullYear < 2000 || !monthNumber) return UNFINISHED_EXPIRY;
  const lastDay = new Date(fullYear, monthNumber, 0).getDate();
  const dayNumber = day ? Number(day) : lastDay;
  if (dayNumber < 1 || dayNumber > lastDay) return UNFINISHED_EXPIRY;
  return `${fullYear}-${pad(monthNumber)}-${pad(dayNumber)}`;
}

export function ExpiryInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [parts, setParts] = useState(() => partsOf(value));
  // Set from outside (form cleared, a batch opened): show that date.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    if (value !== composeExpiry(parts)) setParts(partsOf(value));
  }
  const set = (changes: Partial<Parts>) => {
    const next = { ...parts, ...changes };
    const composed = composeExpiry(next);
    setParts(next);
    setShown(composed);
    onChange(composed);
  };
  const digits = (text: string, max: number) => text.replace(/\D/g, '').slice(0, max);
  const composed = composeExpiry(parts);

  return (
    <>
      <span className="expiry-input" role="group" aria-label="Expiry date: day, month, year">
        <input
          aria-label="Day"
          placeholder="Day"
          inputMode="numeric"
          value={parts.day}
          onChange={(event) => set({ day: digits(event.target.value, 2) })}
          disabled={disabled}
        />
        <select
          aria-label="Month"
          value={parts.month}
          onChange={(event) => set({ month: event.target.value })}
          disabled={disabled}
        >
          <option value="">Month</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        <input
          aria-label="Year"
          placeholder="Year"
          inputMode="numeric"
          value={parts.year}
          onChange={(event) => set({ year: digits(event.target.value, 4) })}
          disabled={disabled}
        />
      </span>
      {!disabled && composed && (
        <small
          className={`expiry-input__hint${composed === UNFINISHED_EXPIRY ? ' is-unfinished' : ''}`}
        >
          {composed === UNFINISHED_EXPIRY
            ? 'Not a full date yet: pick the month and type the year.'
            : `Expires ${new Date(`${composed}T00:00:00`).toLocaleDateString('en-PH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}${parts.day ? '' : ' (end of the month)'}`}
        </small>
      )}
    </>
  );
}
