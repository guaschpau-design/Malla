// Public services of the base map: a hospital on the map opens its point, by name, to be guided
// there; a pharmacy, which the base map carries only in its last level, shows too; the services can
// be hidden like any layer.

import type { Page } from '@playwright/test';

import { device, expect, test } from './helpers.ts';

/** The test base map's hospital, at the centre of this view. */
const VIEW = '/#map=16/39.4750/-0.3700';
/** Its pharmacy, at the centre of this one. */
const PHARMACY_VIEW = '/#map=16/39.4750/-0.3800';

async function tapMapCentre(page: Page): Promise<void> {
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('no map');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Taps the service at the centre until its point opens: the base map's tiles arrive after the page. */
async function openService(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await tapMapCentre(page);
    await expect(page.getByRole('region', { name })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test('a hospital on the map opens by its name and guides there', async ({ browser }) => {
  const page = await device(browser, 'Ana', VIEW);
  await openService(page, 'Hospital de Prueba');
  const hospital = page.getByRole('region', { name: 'Hospital de Prueba' });
  await hospital.getByRole('button', { name: 'Guíame' }).click();
  await expect(page.getByText('Hospital de Prueba').first()).toBeVisible();
});

test('a pharmacy shows on the street map', async ({ browser }) => {
  const page = await device(browser, 'Ana', PHARMACY_VIEW);
  await openService(page, 'Farmacia de Prueba');
});

test('services can be hidden', async ({ browser }) => {
  const page = await device(browser, 'Ana', VIEW);
  await openService(page, 'Hospital de Prueba');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  await page.getByRole('switch', { name: 'Servicios' }).click();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await tapMapCentre(page);
  await expect(page.getByRole('region', { name: 'Hospital de Prueba' })).toBeHidden();
});
