// Minimal translation layer: a reactive current locale and a typed lookup.

import { en, type Messages } from './en.ts';
import { es } from './es.ts';

export type Locale = 'es' | 'en';

export const locales: Readonly<Record<Locale, Messages>> = { es, en };

/** Spanish unless the browser prefers English. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.slice(0, 2).toLowerCase();
    if (base === 'es' || base === 'en') return base;
  }
  return 'es';
}
