// The cadastre's parcels: one picture of the view from its WMS, asked for only where parcels can be
// read; the service's answer is stood in for by a blank picture.

import type { Page } from '@playwright/test';

import { device, expect, mapIdle, test } from './helpers.ts';

const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Answers the cadastre with a blank picture, and keeps what was asked for. */
async function standInForCadastre(page: Page): Promise<URL[]> {
  const asked: URL[] = [];
  await page.route('https://ovc.catastro.meh.es/**', async (route) => {
    asked.push(new URL(route.request().url()));
    await route.fulfill({ contentType: 'image/png', body: BLANK_PNG });
  });
  return asked;
}

async function turnOnCadastre(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  await layers.getByText('Más capas', { exact: true }).click();
  const cadastre = layers.getByRole('switch', { name: 'Catastro' });
  await cadastre.click();
  await expect(cadastre).toHaveAttribute('aria-checked', 'true');
  await layers.getByRole('button', { name: 'Cerrar' }).click();
}

test('the cadastre asks for one picture of the view, in Web Mercator', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/#map=16/39.4750/-0.3700');
  const asked = await standInForCadastre(page);
  await turnOnCadastre(page);
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]?.searchParams.get('SRS')).toBe('EPSG:3857');
  expect(asked[0]?.searchParams.get('REQUEST')).toBe('GetMap');
});

test('the cadastre asks for nothing while too far out to read parcels', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/#map=12/39.4750/-0.3700');
  const asked = await standInForCadastre(page);
  await turnOnCadastre(page);
  await mapIdle(page);
  expect(asked).toEqual([]);
  // Closer in, the same map asks once: a picture asked for further out would be here too.
  await page.evaluate(() => {
    window.location.hash = 'map=16/39.4750/-0.3700';
  });
  await expect.poll(() => asked.length).toBe(1);
  await mapIdle(page);
  expect(asked).toHaveLength(1);
});
