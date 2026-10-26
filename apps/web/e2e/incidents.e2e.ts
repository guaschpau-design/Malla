// Day 4: map objects, SOS calls and alerts reach the whole group.

import { expect, test, type Page } from '@playwright/test';

import { twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

async function tapMapCentre(page: Page): Promise<void> {
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('no map');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('a marker drawn by one member can be opened and deleted by another', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Marcador' }).click();
  await expect(ana.getByText('Toca el mapa donde va el marcador.')).toBeVisible();
  await tapMapCentre(ana);
  await ana.getByRole('radio', { name: 'Fuego' }).check();
  await ana.getByLabel('Etiqueta (opcional)').fill('Foco norte');
  await ana.getByRole('button', { name: 'Guardar' }).click();

  // Berta taps the same spot until the marker has arrived and been drawn.
  const details = berta.getByRole('region', { name: 'Foco norte' });
  await expect(async () => {
    await tapMapCentre(berta);
    await expect(details).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(details).toContainText('Último cambio de Ana');

  berta.once('dialog', (dialog) => void dialog.accept());
  await details.getByRole('button', { name: 'Borrar' }).click();
  await expect(details).toBeHidden();
  await expect(async () => {
    await tapMapCentre(ana);
    await expect(ana.getByRole('region', { name: 'Foco norte' })).toBeHidden({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
});

test('an SOS is acknowledged by the group and cancelled by its sender', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  await berta.getByRole('button', { name: 'SOS', exact: true }).click();
  const dialog = berta.getByRole('dialog', { name: 'Enviar un SOS' });
  await dialog.getByLabel('Qué pasa').selectOption({ label: 'Médica' });
  await dialog.getByLabel('Detalles (opcional)').fill('Tobillo roto');
  await expect(dialog.getByText(/Se envía tu posición/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Enviar SOS' }).click();

  const call = ana.getByRole('region', { name: 'SOS' });
  await expect(call).toContainText('SOS · Berta · Médica');
  await expect(call).toContainText('Tobillo roto');
  await call.getByRole('button', { name: 'Recibido' }).click();
  await expect(berta.getByRole('region', { name: 'SOS' })).toContainText('Recibido por Ana');

  berta.once('dialog', (confirm) => void confirm.accept());
  await berta.getByRole('button', { name: 'Cancelar SOS' }).click();
  await expect(call).toBeHidden();
});

test('a critical alert stays on screen until each member acknowledges it', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Chat' }).click();
  await ana.getByLabel('Mensaje').fill('Evacuad la zona norte');
  await ana.getByRole('button', { name: 'Enviar como alerta' }).click();

  const alert = berta.getByRole('region', { name: 'Alerta crítica' });
  await expect(alert).toContainText('Evacuad la zona norte');
  await alert.getByRole('button', { name: 'Recibido' }).click();
  await expect(alert).toBeHidden();
  await ana.getByRole('region', { name: 'Chat' }).getByRole('button', { name: 'Cerrar' }).click();
  await expect(ana.getByRole('region', { name: 'Alerta crítica' })).toContainText(
    'Recibido por Berta',
  );
});

test('an area is drawn point by point and described before it is shared', async ({ browser }) => {
  const { ana } = await twoMembers(browser, VIEW);
  const box = await ana.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('no map');
  const at = (dx: number, dy: number) =>
    ana.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await expect(ana.getByRole('button', { name: 'Terminar' })).toBeDisabled();
  await at(-80, -80);
  await at(80, -80);
  await at(80, 80);
  await at(-80, 80);
  await ana.getByRole('button', { name: 'Deshacer' }).click();
  await ana.getByRole('button', { name: 'Terminar' }).click();
  await ana.getByRole('radio', { name: 'Zona de peligro' }).check();
  await ana.getByRole('button', { name: 'Guardar' }).click();

  // The triangle left after undoing covers the point to the right of the centre.
  const details = ana.getByRole('region', { name: 'Zona de peligro' });
  await expect(async () => {
    await at(40, -20);
    await expect(details).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
});
