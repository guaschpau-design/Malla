// Renders the app icons from brand/mark.svg with the Chromium that Playwright provides:
//
//   pnpm --filter @tesel/web icons
//
// Writes apps/web/public/icons: the PWA icons (any and maskable), the Apple touch icon and the
// favicons. The mark sits on the ink of the app's top bar; maskable icons keep it inside the
// safe zone (80 % of the width) that launchers may crop to a circle.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));

const INK = '#10202c';
const mark = readFileSync(join(here, '..', '..', '..', 'brand', 'mark.svg'), 'utf8');
const out = join(here, '..', 'public', 'icons');

/** An icon page: the mark at `scale` of the square, on ink, with rounded corners when asked. */
function page(size, scale, radius) {
  const inner = Math.round(size * scale);
  const pad = Math.round((size - inner) / 2);
  return `<!doctype html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;background:${INK};border-radius:${radius}px;overflow:hidden">
      <div style="width:${inner}px;height:${inner}px;margin:${pad}px">${mark.replace('<svg ', '<svg style="display:block;width:100%;height:100%" ')}</div>
    </div></body>`;
}

const icons = [
  { file: 'icon-192.png', size: 192, scale: 0.82, radius: 0 },
  { file: 'icon-512.png', size: 512, scale: 0.82, radius: 0 },
  { file: 'maskable-512.png', size: 512, scale: 0.64, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.82, radius: 0 },
  { file: 'favicon-64.png', size: 64, scale: 0.9, radius: 12 },
];

await (async () => {
  const browser = await chromium.launch();
  for (const icon of icons) {
    const tab = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await tab.setContent(page(icon.size, icon.scale, icon.radius));
    const png = await tab.screenshot({ omitBackground: true });
    writeFileSync(join(out, icon.file), png);
    await tab.close();
  }
  await browser.close();
  // The SVG favicon: the mark on a rounded ink square, crisp at any size.
  writeFileSync(
    join(out, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="${INK}"/><g transform="translate(5 5) scale(0.9)" color="#e6ebe8">${mark.replace(/<svg[^>]*>|<\/svg>/g, '')}</g></svg>`,
  );
  console.warn(`${icons.length} icons and favicon.svg written to ${out}`);
})();
