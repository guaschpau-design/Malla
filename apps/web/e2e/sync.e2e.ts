// Day 3: two devices in a group see each other's messages and positions through the server.

import { device, expect, shareAs, test, twoMembers } from './helpers.ts';
import { SERVER_URL } from './ports.ts';

test('new groups propose the build’s own server', async ({ browser }) => {
  const ana = await device(browser, 'Ana');
  await ana.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await ana.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(ana.getByLabel('Servidor')).toHaveValue(`${SERVER_URL}/`);
});

test('members of a group chat and see who shares their position', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);

  // Chat both ways, with aliases learnt from each member's announcement.
  await ana.getByRole('button', { name: 'Chat' }).click();
  await ana.getByLabel('Mensaje').fill('¿Me recibís?');
  await ana.getByRole('button', { name: 'Enviar', exact: true }).click();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
  await expect(berta.getByRole('listitem').filter({ hasText: '¿Me recibís?' })).toContainText(
    'Ana ·',
  );
  await berta.getByLabel('Mensaje').fill('Alto y claro');
  await berta.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(ana.getByText('Alto y claro')).toBeVisible();

  // Berta shares her position; Ana's member list shows it, then shows when she hides it.
  await berta.getByRole('button', { name: 'Cerrar' }).click();
  await shareAs(berta, 'Compartir');
  await expect(berta.getByRole('button', { name: 'Yo: Compartiendo posición' })).toBeVisible();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await ana.getByRole('button', { name: /^Grupos:/ }).click();
  // The member list says it with a sign, named for screen readers.
  const bertaRow = ana.getByRole('listitem').filter({ hasText: /^B\s*Berta/ });
  await expect(bertaRow.getByRole('img', { name: 'comparte posición', exact: true })).toBeVisible();
  await shareAs(berta, 'Ocultar');
  await expect(
    bertaRow.getByRole('img', { name: 'no comparte posición', exact: true }),
  ).toBeVisible();

  // A device that reloads gets the history from its own log and the server.
  await berta.reload();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
});

test('sharing resumes by itself after the app restarts', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);
  await shareAs(berta, 'Compartir');
  await expect(berta.getByRole('button', { name: 'Yo: Compartiendo posición' })).toBeVisible();
  await berta.reload();
  await expect(berta.getByRole('button', { name: 'Yo: Compartiendo posición' })).toBeVisible();
  await ana.getByRole('button', { name: /^Grupos:/ }).click();
  await expect(
    ana
      .getByRole('listitem')
      .filter({ hasText: /^B\s*Berta/ })
      .getByRole('img', { name: 'comparte posición', exact: true }),
  ).toBeVisible();
});
