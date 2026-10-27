// Minimal translation layer: dictionaries, locale detection and placeholder formatting.

import { en, type MessageKey, type Messages } from './en.ts';
import { es } from './es.ts';

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export type { MessageKey, Messages };

export const locales: Readonly<Record<Locale, Messages>> = { es, en };

/** Each language by its own name, as a language menu shows it. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { es: 'Español', en: 'English' };

/** The interface's language: the browser's, or one chosen in the app. */
export const LANGUAGE_CHOICES = ['auto', ...LOCALES] as const;
export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number];

/** The language to show: the one chosen, or else the browser's. */
export function resolveLocale(choice: LanguageChoice, languages: readonly string[]): Locale {
  return choice === 'auto' ? detectLocale(languages) : choice;
}

/** The language after `locale`, round the list: what the language item of a menu switches to. */
export function nextLocale(locale: Locale): Locale {
  return LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length] ?? locale;
}

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
