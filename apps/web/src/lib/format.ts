// Locale-aware formatting of sizes, dates and measures.

import type { Locale } from './i18n/index.ts';

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

/** Metres up to a kilometre, then kilometres with one decimal below ten. */
export function formatDistance(metres: number, locale: string): string {
  if (metres < 1000) return `${Math.round(metres).toLocaleString(locale)} m`;
  const km = metres / 1000;
  return `${km.toLocaleString(locale, { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

/** Square metres, then hectares, then square kilometres, as land is measured in each size. */
export function formatArea(squareMetres: number, locale: string): string {
  if (squareMetres < 10_000) return `${Math.round(squareMetres).toLocaleString(locale)} m²`;
  if (squareMetres < 1_000_000) {
    return `${(squareMetres / 10_000).toLocaleString(locale, { maximumFractionDigits: 1 })} ha`;
  }
  const km2 = squareMetres / 1_000_000;
  return `${km2.toLocaleString(locale, { maximumFractionDigits: km2 < 10 ? 2 : 1 })} km²`;
}

/** The eight compass points, from north clockwise; Spanish writes O for west. */
const COMPASS: Readonly<Record<Locale, readonly string[]>> = {
  es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

/** A bearing as three digits and its compass point: "047° NE". */
export function formatBearing(degrees: number, locale: Locale): string {
  const whole = Math.round(degrees) % 360;
  const point = COMPASS[locale][Math.round(whole / 45) % 8] ?? '';
  return `${String(whole).padStart(3, '0')}° ${point}`;
}
