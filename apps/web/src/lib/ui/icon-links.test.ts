import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { iconLinks, iconVersion, PAGES_WITH_ICONS, stampIconLinks } from './icon-links.ts';

const root = new URL('../../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('icon links', () => {
  it('point every page at the current icons, so browsers fetch them again when they change', () => {
    const version = iconVersion(read('apps/web/public/icons/favicon.svg'));
    for (const page of PAGES_WITH_ICONS) {
      const links = iconLinks(read(page));
      expect(links, page).toHaveLength(3);
      for (const link of links) expect(link, page).toMatch(new RegExp(`\\?v=${version}$`));
    }
  });

  it('replace an old version and add one where there was none', () => {
    const html =
      '<link href="icons/favicon.svg?v=0badcafe" /><link href="../icons/favicon-64.png" />';
    expect(stampIconLinks(html, '12345678')).toBe(
      '<link href="icons/favicon.svg?v=12345678" /><link href="../icons/favicon-64.png?v=12345678" />',
    );
  });

  it('gives different icons different versions', () => {
    expect(iconVersion('<svg>a</svg>')).not.toBe(iconVersion('<svg>b</svg>'));
    expect(iconVersion('<svg>a</svg>')).toMatch(/^[0-9a-f]{8}$/);
  });
});
