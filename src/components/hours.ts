export function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

/** Hours to show: store hours (8 AM–8 PM), widened to fit any sale outside them. */
export function hourRange(dates: Date[], from = 8, to = 20) {
  const hours = dates.map((date) => date.getHours());
  const start = Math.min(from, ...hours);
  const end = Math.max(to, ...hours);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
