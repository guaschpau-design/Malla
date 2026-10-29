import { device, expect, openMore, stored, test } from './helpers.ts';

test('a dictated coordinate is found on the map and read in another format', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await openMore(page, 'Ir a una coordenada');
  await page.getByLabel('Coordenadas').fill('39,4699 -0,3763');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Punto del mapa' });
  await expect(panel.locator('output')).toHaveText('39.46990, -0.37630');

  // The format is chosen once, in Me, and every coordinate follows it.
  await page.getByRole('button', { name: /^Yo/ }).click();
  const me = page.getByRole('region', { name: 'Yo' });
  await me.getByLabel('Formato de coordenadas').selectOption('MGRS');
  await me.getByRole('button', { name: 'Cerrar' }).click();
  await openMore(page, 'Ir a una coordenada');
  await page.getByLabel('Coordenadas').fill('39,4699 -0,3763');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  await expect(panel.locator('output')).toHaveText('30S YJ 25695 72210');

  // The format is remembered.
  await expect.poll(() => stored(page, 'settings', 'coordinateFormat')).toBe('mgrs');
  await page.reload();
  await page.locator('.maplibregl-canvas').click({ button: 'right' });
  await expect(page.getByRole('region', { name: 'Punto del mapa' }).locator('output')).toHaveText(
    /^\d{1,2}[C-X] [A-Z]{2} \d{5} \d{5}$/,
  );
});

test('a coordinate that cannot be read says which formats can', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await openMore(page, 'Ir a una coordenada');
  await page.getByLabel('Coordenadas').fill('al lado del puente');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  await expect(
    page.getByText('Tesel no reconoce estas coordenadas.', { exact: false }),
  ).toBeVisible();
});
