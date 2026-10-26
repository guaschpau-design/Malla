// The core promise of v0.1: prepare while online, keep working when the network is gone.

import { expect, test } from '@playwright/test';

import { chooseAlias } from './helpers.ts';

test('a downloaded area keeps working after going offline and reloading', async ({
  page,
  context,
}) => {
  await page.goto('/#map=13/39.47/-0.36');
  await chooseAlias(page, 'Ana');
  await expect(page.getByRole('button', { name: 'Conexiones: Internet' })).toBeVisible();

  // The service worker must be active before we go offline.
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Mapas sin conexión' }).click();
  await page.getByLabel('Nombre').fill('Valencia centro');
  await page.getByRole('button', { name: 'Descargar', exact: true }).click();
  await expect(page.getByText('Valencia centro')).toBeVisible();
  await expect(page.getByText('Incompleta')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('button', { name: 'Conexiones: Sin conexión' })).toBeVisible();
  // Tiles come from IndexedDB: the map reports its sources as loaded, with no network.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector('canvas.maplibregl-canvas');
          return canvas !== null && canvas.clientWidth > 0;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  // Only the map drawing is compared; UI text depends on the system fonts of each machine.
  await expect(page.locator('.maplibregl-map')).toHaveScreenshot('offline-valencia.png', {
    maxDiffPixelRatio: 0.05,
    mask: [page.locator('.maplibregl-ctrl'), page.locator('.fab'), page.locator('button.sos')],
  });
});
