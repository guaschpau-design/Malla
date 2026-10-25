// Minimal translation layer: dictionaries, locale detection and placeholder formatting.

import { en, type MessageKey, type Messages } from './en.ts';
import { es } from './es.ts';

export type Locale = 'es' | 'en';
export type { MessageKey, Messages };

export const locales: Readonly<Record<Locale, Messages>> = { es, en };

/** Spanish unless the browser prefers English. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.slice(0, 2).toLowerCase();
    if (base === 'es' || base === 'en') return base;
  }
  return 'es';
}

export type Translate = (
  key: MessageKey,
  values?: Readonly<Record<string, string | number>>,
) => string;

/** Returns a function that looks up a key and fills `{placeholders}`. */
export function translator(locale: Locale): Translate {
  const messages = locales[locale];
  return (key, values = {}) =>
    messages[key].replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
