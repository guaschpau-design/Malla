// Minimal translation layer: dictionaries, locale detection, plural forms and placeholder
// formatting.

import { en, type MessageKey, type Messages, type PluralKey } from './en.ts';
import { es } from './es.ts';

const LOCALES = ['es', 'en'] as const;
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

type Values = Readonly<Record<string, string | number>>;

/**
 * Looks up a text and fills its `{placeholders}`. A text with plural forms needs its `count`, which
 * picks the form; for any other the values are optional.
 */
export type Translate = <K extends MessageKey>(
  key: K,
  ...values: K extends PluralKey ? [values: Values & { readonly count: number }] : [values?: Values]
) => string;

/** Returns a function that looks up a key, picks its plural form and fills `{placeholders}`. */
export function translator(locale: Locale): Translate {
  const messages: Messages = locales[locale];
  const plurals = new Intl.PluralRules(locale);
  // Numbers are written as the language writes them: "12,345" in English, "12.345" in Spanish.
  const numbers = new Intl.NumberFormat(locale);
  return (key, ...[values = {}]) => {
    const message = messages[key];
    // A language need not use every category: Spanish says "many" of millions, and writes them as
    // it writes "other".
    const text =
      typeof message === 'string'
        ? message
        : (message[plurals.select(Number(values['count']))] ?? message.other);
    return text.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      if (value === undefined) return match;
      return typeof value === 'number' ? numbers.format(value) : value;
    });
  };
}
