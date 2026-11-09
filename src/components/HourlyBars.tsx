/*
 * Sales per hour as bars. The busiest hour is darker and labelled, the current hour
 * is marked, and an optional dashed line shows a usual day (average) for comparison.
 */

import { formatHour } from './hours';

export type HourSlot = { hour: number; amount: number; average?: number };

export function HourlyBars({
  slots,
  nowHour,
  label,
}: {
  slots: HourSlot[];
  /** Hour to mark as "now" (today only). */
  nowHour?: number;
  label: string;
}) {
  const top = Math.max(1, ...slots.map((slot) => Math.max(slot.amount, slot.average ?? 0)));
  const peak = slots.reduce<HourSlot | null>(
    (best, slot) => (slot.amount > (best?.amount ?? 0) ? slot : best),
    null,
  );

  return (
    <div className="dash-bars" role="img" aria-label={label}>
      {slots.map((slot) => {
        const isPeak = peak?.hour === slot.hour;
        return (
          <div
            className={`dash-bar${isPeak ? ' is-peak' : ''}${slot.hour === nowHour ? ' is-now' : ''}`}
            key={slot.hour}
            title={`${formatHour(slot.hour)}: ₱${slot.amount.toFixed(2)}${
              slot.average !== undefined ? ` · usual ₱${slot.average.toFixed(2)}` : ''
            }`}
          >
            <div className="dash-bar__track">
              {slot.average !== undefined && slot.average > 0 && (
                <i className="dash-bar__avg" style={{ bottom: `${(slot.average / top) * 100}%` }} />
              )}
              <div
                className={`dash-bar__fill${slot.amount ? '' : ' is-empty'}`}
                style={{ height: `${Math.max(3, (slot.amount / top) * 100)}%` }}
              >
                {slot.amount ? (
                  <span>₱{Math.round(slot.amount).toLocaleString('en-PH')}</span>
                ) : null}
              </div>
            </div>
            <small>{slot.hour === nowHour ? 'Now' : formatHour(slot.hour)}</small>
          </div>
        );
      })}
    </div>
  );
}
