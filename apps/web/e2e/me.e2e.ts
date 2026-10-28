// "Me": what a member tells the team about themselves, and how the others see it.

import { expect, shareAs, tapMapUntil, test, twoMembers } from './helpers.ts';

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
  await expect(card.getByText('Tareas', { exact: true })).toBeVisible();
});
