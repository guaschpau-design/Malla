// "Me": what a member tells the team about themselves, and how the others see it.

import { createGroup, device, expect, shareAs, tapMapUntil, test, twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

test('a member’s profile, status and equipment reach the others', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);
  await shareAs(berta, 'Compartir');

  // Berta says who she is, that she is resting and what she carries.
  await berta.getByRole('button', { name: /^Yo/ }).click();
  const me = berta.getByRole('region', { name: 'Yo' });
  await me.getByLabel('Perfil').selectOption({ label: 'Protección Civil' });
  await me.getByRole('radio', { name: 'En descanso' }).click();
  await expect(me.getByRole('radio', { name: 'En descanso' })).toBeChecked();
  await me.getByText('Equipamiento', { exact: true }).click();
  await me.getByRole('button', { name: 'Botiquín' }).click();
  await me.getByRole('button', { name: 'Agua' }).click();
  await expect(me.getByText('Botiquín, Agua')).toBeVisible();
  await me.getByRole('button', { name: 'Cerrar' }).click();

  // Ana taps her on the map and sees it all at a glance.
  const card = ana.getByRole('region', { name: 'Berta' });
  await tapMapUntil(ana, {}, async () => {
    await expect(card).toBeVisible();
    await expect(card).toContainText('En descanso · Protección Civil');
  });
  await expect(card).toContainText('Botiquín, Agua');
  // Her app has no LoRa radio linked: without coverage she cannot be reached, and the card says so.
  await expect(card).toContainText('Sin radio LoRa');
  await expect(card.getByText('Tareas', { exact: true })).toBeVisible();
});

test('much equipment keeps the panel as narrow as a phone', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/', { viewport: { width: 390, height: 780 } });
  await createGroup(page, 'Rescate Valencia');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: /^Yo/ }).click();
  const me = page.getByRole('region', { name: 'Yo' });
  await me.getByText('Equipamiento', { exact: true }).click();
  const chips = me.locator('button[aria-pressed="false"]');
  for (let left = await chips.count(); left > 0; left -= 1) await chips.first().click();
  await me.getByText('Equipamiento', { exact: true }).click();
  const sideways = await me.evaluate((panel) => panel.scrollWidth - panel.clientWidth);
  expect(sideways).toBe(0);
});

test('Me says whether a LoRa radio keeps this person in touch, and leads to linking one', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: /^Yo/ }).click();
  const me = page.getByRole('region', { name: 'Yo' });
  await expect(me).toContainText('Sin radio LoRa: si cae la cobertura');
  // Not something to pick by hand: the app knows whether a radio is linked.
  await me.getByText('Equipamiento', { exact: true }).click();
  await expect(me.getByRole('button', { name: /LoRa/ })).toHaveCount(0);
  await me.getByRole('button', { name: 'Conectar radio' }).click();
  await expect(page.getByRole('region', { name: 'LoRa' })).toBeVisible();
});
