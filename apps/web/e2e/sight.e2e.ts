// The radio line of sight between a point and another, over flat ground: two radios in hand a few
// hundred metres apart lack room for the signal; on masts they see each other.

import { readFileSync } from 'node:fs';

import { device, expect, test } from './helpers.ts';

const FLAT = readFileSync(new URL('fixtures/flat-terrain.png', import.meta.url));

test('a radio link over flat ground is marginal in hand and clear on masts', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', '/#map=14/39.4699/-0.3763');
  await page.route('https://tiles.mapterhorn.com/**', (route) =>
    route.fulfill({ body: FLAT, contentType: 'image/png' }),
  );
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no map');

  await canvas.click({ button: 'right', position: { x: box.width / 2, y: box.height / 2 } });
  await page
    .getByRole('region', { name: 'Punto del mapa' })
    .getByRole('button', { name: 'Visión radio' })
    .click();
  const card = page.getByRole('status').filter({ hasText: 'Antena en el punto' });
  await expect(card).toContainText('Toca en el mapa el otro extremo');

  // About 370 m away at this zoom.
  await page.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2);
  await expect(card).toContainText('Justo: puede fallar');

  await card.getByLabel('Antena en el punto').selectOption({ label: '30 m' });
  await card.getByLabel('Antena en el otro extremo').selectOption({ label: '30 m' });
  await expect(card).toContainText('Despejada sobre el terreno');
  await expect(card).toContainText('Sin contar edificios ni árboles');
});
