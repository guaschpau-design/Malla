// Locale-aware formatting of sizes and dates.

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number, locale: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${UNITS[unit] ?? ''}`;
}

export function formatDateTime(time: number, locale: string): string {
  return new Date(time).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

/** Time of day for today's moments, date and time for older ones. */
export function formatTime(time: number, locale: string, now: number = Date.now()): string {
  const date = new Date(time);
  return date.toDateString() === new Date(now).toDateString()
    ? date.toLocaleTimeString(locale, { timeStyle: 'short' })
    : formatDateTime(time, locale);
}
