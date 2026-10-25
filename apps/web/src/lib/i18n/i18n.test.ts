import { describe, expect, it } from 'vitest';

import { en } from './en.ts';
import { es } from './es.ts';
import { detectLocale, translator } from './index.ts';

describe('translations', () => {
  it('detects the browser language, defaulting to Spanish', () => {
    expect(detectLocale(['en-GB', 'es'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('es');
  });

  it('fills placeholders', () => {
    expect(translator('en')('downloading', { done: 3, total: 10 })).toBe('Downloading… 3 of 10');
  });

  it('uses the same placeholders in every language', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key])).toEqual(placeholders(en[key]));
    }
  });
});
