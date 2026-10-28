// The core promise of v0.1: prepare while online, keep working when the network is gone.

import { chooseAlias, expect, mapIdle, openMore, test, twoMembers } from './helpers.ts';

test('a downloaded area keeps working after going offline and reloading', async ({
  page,
  context,
}) => {
  await page.goto('/#map=13/39.47/-0.36');
  await chooseAlias(page, 'Ana');
  await expect(page.getByRole('button', { name: /^Conexiones: WiFi/ })).toBeVisible();

  // The service worker must be active before we go offline.
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active),
    )
    .toBe(true);

  await openMore(page, 'Mapas sin conexión');
  await page.getByLabel('Nombre').fill('Valencia centro');
  await page.getByRole('button', { name: 'Descargar', exact: true }).click();
  await expect(page.getByText('Valencia centro')).toBeVisible();
  await expect(page.getByText('Incompleta')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('button', { name: 'Conexiones: Sin conexión' })).toBeVisible();
  // Tiles come from IndexedDB: the map loads its sources and settles, with no network.
  await mapIdle(page);
  // Only the map drawing is compared; UI text depends on the system fonts of each machine.
  await expect(page.locator('.maplibregl-map')).toHaveScreenshot('offline-valencia.png', {
    maxDiffPixelRatio: 0.05,
    mask: [page.locator('.maplibregl-ctrl'), page.locator('.dock'), page.locator('button.sos')],
  });
});

test('members are offered the map of the operation area their coordinator marks', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser, '/#map=15/39.47/-0.37');
  const box = await ana.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('no map');
  const at = (dx: number, dy: number) =>
    ana.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await at(-60, -60);
  await at(60, -60);
  await at(0, 60);
  await ana.getByRole('button', { name: 'Terminar' }).click();
  await ana.getByRole('radio', { name: 'Zona del operativo' }).check();
  await ana.getByLabel('Etiqueta (opcional)').fill('Sector norte');
  await ana.getByRole('button', { name: 'Guardar' }).click();

  const offer = berta.getByRole('region', { name: 'Zona del operativo «Sector norte»' });
  await offer.getByRole('button', { name: 'Descargar' }).click();
  await expect(offer).toBeHidden();
  await openMore(berta, 'Mapas sin conexión');
  await expect(berta.getByText('Sector norte')).toBeVisible();
});
