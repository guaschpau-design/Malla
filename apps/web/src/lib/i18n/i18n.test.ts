import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { en } from './en.ts';
import { es } from './es.ts';
import { detectLocale, nextLocale, resolveLocale, translator } from './index.ts';

describe('translations', () => {
  it('detects the browser language, defaulting to Spanish', () => {
    expect(detectLocale(['en-GB', 'es'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('es');
  });

  it('shows the language chosen, or else the browser’s', () => {
    expect(resolveLocale('auto', ['en-US'])).toBe('en');
    expect(resolveLocale('es', ['en-US'])).toBe('es');
  });

  it('switches to the next language, round the list', () => {
    expect(nextLocale('es')).toBe('en');
    expect(nextLocale('en')).toBe('es');
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

describe('texts in use', () => {
  it('has no text that nothing shows', async () => {
    const root = join(import.meta.dirname, '..', '..');
    const files = (await readdir(root, { recursive: true })).filter(
      (file) => /\.(ts|svelte)$/.test(file) && !file.includes('i18n'),
    );
    const sources = (
      await Promise.all(files.map((file) => readFile(join(root, file), 'utf8')))
    ).join('\n');
    const unused = Object.keys(en).filter((key) => !sources.includes(`'${key}'`));
    expect(unused).toEqual([]);
  });
});
