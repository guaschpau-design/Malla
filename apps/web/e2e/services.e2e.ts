// Public services of the base map: a hospital on the map opens its point, by name, to be guided
// there; a pharmacy, which the base map carries only in its last level, shows too; the services can
// be hidden like any layer.

import type { Page } from '@playwright/test';

import { device, expect, tapMap, test } from './helpers.ts';

/** The test base map's hospital, at the centre of this view. */
const VIEW = '/#map=16/39.4750/-0.3700';
/** Its pharmacy, at the centre of this one. */
const PHARMACY_VIEW = '/#map=16/39.4750/-0.3800';

/** Taps the service at the centre and waits for its point to open. */
async function openService(page: Page, name: string): Promise<void> {
  await tapMap(page);
  await expect(page.getByRole('region', { name })).toBeVisible();
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
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  const services = layers.getByRole('switch', { name: 'Servicios' });
  await services.click();
  // The switch turns off once the choice is stored, and the map follows it.
  await expect(services).toHaveAttribute('aria-checked', 'false');
  await layers.getByRole('button', { name: 'Cerrar' }).click();
  await tapMap(page);
  await expect(page.getByRole('region', { name: 'Hospital de Prueba' })).toBeHidden();
});
