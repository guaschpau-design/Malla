// Day 3: two devices in a group see each other's messages and positions through the server.

import { expect, test } from '@playwright/test';

import { device, twoMembers } from './helpers.ts';

test('new groups propose the build’s own server', async ({ browser }) => {
  const ana = await device(browser, 'Ana');
  await ana.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await expect(ana.getByLabel('Servidor')).toHaveValue('http://localhost:8787');
});

test('members of a group chat and see who shares their position', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);

  // Chat both ways, with aliases learnt from each member's announcement.
  await ana.getByRole('button', { name: 'Chat' }).click();
  await ana.getByLabel('Mensaje').fill('¿Me recibís?');
  await ana.getByRole('button', { name: 'Enviar' }).click();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
  await expect(berta.getByRole('listitem').filter({ hasText: '¿Me recibís?' })).toContainText(
    'Ana ·',
  );
  await berta.getByLabel('Mensaje').fill('Alto y claro');
  await berta.getByRole('button', { name: 'Enviar' }).click();
  await expect(ana.getByText('Alto y claro')).toBeVisible();

  // Berta shares her position; Ana's member list shows it, then shows when she hides it.
  await berta.getByRole('button', { name: 'Cerrar' }).click();
  await berta.getByRole('button', { name: 'Mi posición: Posición oculta' }).click();
  await berta.getByRole('menuitemradio', { name: /^Compartir/ }).click();
  await expect(
    berta.getByRole('button', { name: 'Mi posición: Compartiendo posición' }),
  ).toBeVisible();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await ana.getByRole('button', { name: /^Grupos:/ }).click();
  const bertaRow = ana.getByRole('listitem').filter({ hasText: /^Berta/ });
  await expect(bertaRow).toContainText('comparte posición');
  await berta.getByRole('button', { name: 'Mi posición: Compartiendo posición' }).click();
  await berta.getByRole('menuitemradio', { name: /^Ocultar/ }).click();
  await expect(bertaRow).toContainText('no comparte posición');

  // A device that reloads gets the history from its own log and the server.
  await berta.reload();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
});

test('sharing resumes by itself after the app restarts', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);
  await berta.getByRole('button', { name: 'Mi posición: Posición oculta' }).click();
  await berta.getByRole('menuitemradio', { name: /^Compartir/ }).click();
  await expect(
    berta.getByRole('button', { name: 'Mi posición: Compartiendo posición' }),
  ).toBeVisible();
  await berta.reload();
  await expect(
    berta.getByRole('button', { name: 'Mi posición: Compartiendo posición' }),
  ).toBeVisible();
  await ana.getByRole('button', { name: /^Grupos:/ }).click();
  await expect(ana.getByRole('listitem').filter({ hasText: /^Berta/ })).toContainText(
    'comparte posición',
  );
});
