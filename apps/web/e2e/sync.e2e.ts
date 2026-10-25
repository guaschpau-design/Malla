// Day 3: two devices in a group see each other's messages and positions through the server.

import { expect, test, type Browser, type Page } from '@playwright/test';

import { chooseAlias } from './helpers.ts';

const VALENCIA = { latitude: 39.4699, longitude: -0.3763 };

async function device(browser: Browser, alias: string): Promise<Page> {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: VALENCIA,
  });
  const page = await context.newPage();
  return page.goto('/').then(async () => {
    await chooseAlias(page, alias);
    return page;
  });
}

test('members of a group chat and see who shares their position', async ({ browser }) => {
  const ana = await device(browser, 'Ana');
  await ana.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await ana.getByLabel('Nombre del grupo').fill('Rescate Valencia');
  // The build proposes its own server for new groups.
  await expect(ana.getByLabel('Servidor')).toHaveValue('http://localhost:8787');
  await ana.getByRole('button', { name: 'Crear', exact: true }).click();
  await ana.getByRole('button', { name: 'Invitar' }).click();
  const link = await ana.getByLabel('Enlace de invitación').inputValue();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ana.getByTitle('Sincronizado')).toBeVisible();

  const berta = await device(browser, 'Berta');
  await berta.goto(link);
  await berta.getByRole('dialog').getByRole('button', { name: 'Unirme' }).click();
  await expect(berta.getByTitle('Sincronizado')).toBeVisible();

  // Chat both ways, with aliases learnt from each member's announcement.
  await ana.getByRole('button', { name: 'Chat' }).click();
  await ana.getByLabel('Mensaje').fill('¿Me recibís?');
  await ana.getByRole('button', { name: 'Enviar' }).click();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
  await expect(berta.getByText(/^Ana ·/)).toBeVisible();
  await berta.getByLabel('Mensaje').fill('Alto y claro');
  await berta.getByRole('button', { name: 'Enviar' }).click();
  await expect(ana.getByText('Alto y claro')).toBeVisible();

  // Berta shares her position; Ana's member list shows it, then shows when she stops.
  await berta.getByRole('button', { name: 'Cerrar' }).click();
  await berta.getByRole('button', { name: 'Compartir mi posición' }).click();
  await expect(berta.getByRole('button', { name: 'Compartiendo posición' })).toBeVisible();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await ana.getByRole('button', { name: /^Grupos:/ }).click();
  const bertaRow = ana.getByRole('listitem').filter({ hasText: /^Berta/ });
  await expect(bertaRow).toContainText('comparte posición');
  await berta.getByRole('button', { name: 'Compartiendo posición' }).click();
  await expect(bertaRow).toContainText('no comparte posición');

  // A device that reloads gets the history from its own log and the server.
  await berta.reload();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
});
