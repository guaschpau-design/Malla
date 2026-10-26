import { expect, test } from '@playwright/test';

import { device } from './helpers.ts';

test('a point picked on the map is measured from here and navigated to', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  // Wait for the map to centre on this device, then pick a point above it.
  await expect(page.getByRole('button', { name: 'Dejar de mostrar mi ubicación' })).toBeVisible();
  await page.waitForTimeout(1500);
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no map');
  await canvas.click({ button: 'right', position: { x: box.width / 2, y: box.height / 2 - 150 } });

  const panel = page.getByRole('region', { name: 'Coordenadas' });
  await expect(panel.getByText(/^\d+ m · 00\d° N desde ti$/)).toBeVisible();
  await panel.getByRole('button', { name: 'Guíame hasta aquí' }).click();

  const card = page.getByRole('status').filter({ hasText: 'Hacia Punto del mapa' });
  await expect(card).toContainText(/\d+ m · 00\d° N/);
  await card.getByRole('button', { name: 'Parar' }).click();
  await expect(card).toBeHidden();
});

test('distances are measured point by point, with the area they enclose', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: 'Herramientas' }).click();
  await page.getByRole('menuitem', { name: 'Medir distancias' }).click();
  const card = page.getByRole('status').filter({ hasText: 'Toca el mapa para medir' });
  await expect(card).toBeVisible();

  const canvas = page.locator('.maplibregl-canvas');
  for (const position of [
    { x: 100, y: 300 },
    { x: 250, y: 300 },
    { x: 250, y: 450 },
  ]) {
    await canvas.click({ position });
  }
  const measures = page.getByRole('status').filter({ hasText: 'área encerrada' });
  await expect(measures).toContainText(/^\s*[\d,.]+ (m|km) · área encerrada [\d,.]+ (m²|ha|km²)/);
  await measures.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('área encerrada')).toBeHidden();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Herramientas' })).toBeVisible();
});
