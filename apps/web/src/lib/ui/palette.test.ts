// The brand's colours are written in three places that cannot import each other: the logo's
// generator reads brand/colors.json, the app's tokens are CSS (app.css) and so are the site's
// (no build step, ADR-0017). This keeps the three in step, and every family of map colour defined.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { TONES } from './theme.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const BRAND = JSON.parse(read('../../../../../brand/colors.json')) as Record<string, string>;
const APP_CSS = read('../../app.css');
const SITE_CSS = read('../../../../site/styles.css');

/** The value a stylesheet gives a custom property in its first (light) definition. */
function token(css: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim().toLowerCase();
}

describe('palette', () => {
  it('gives the app the brand colours of brand/colors.json', () => {
    expect(token(APP_CSS, 'ink')).toBe(BRAND['ink']);
    expect(token(APP_CSS, 'pale')).toBe(BRAND['pale']);
    expect(token(APP_CSS, 'signal')).toBe(BRAND['signal']);
    expect(token(APP_CSS, 'signal-deep')).toBe(BRAND['signalDeep']);
  });

  it('gives the site the same brand colours', () => {
    expect(token(SITE_CSS, 'ink')).toBe(BRAND['ink']);
    expect(token(SITE_CSS, 'ink-text')).toBe(BRAND['pale']);
    expect(token(SITE_CSS, 'signal')).toBe(BRAND['signal']);
    expect(token(SITE_CSS, 'signal-deep')).toBe(BRAND['signalDeep']);
  });

  it('defines a colour for every family the map uses', () => {
    for (const tone of TONES) expect(token(APP_CSS, `tone-${tone}`)).toBeDefined();
  });
});
