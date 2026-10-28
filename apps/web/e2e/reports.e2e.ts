// Situation reports: written from the chat, pinned in their own tab, and seen by the whole group.

import { expect, test, twoMembers } from './helpers.ts';

test('a situation report is sent from the chat and pinned for the group', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);

  // Berta reports a fire with one casualty, from the chat.
  await berta.getByRole('button', { name: 'Chat' }).click();
  const chat = berta.getByRole('region', { name: 'Chat' });
  await chat.getByRole('button', { name: 'Más acciones' }).click();
  await chat.getByRole('menuitem', { name: 'Nuevo parte' }).click();
  await chat.getByRole('button', { name: 'Incendio' }).click();
  await chat.getByRole('button', { name: 'Rojo: uno más' }).click();
  await chat.getByText('Peligros', { exact: true }).click();
  await chat.getByRole('button', { name: 'Humo' }).click();
  await chat.getByText('Hace falta', { exact: true }).click();
  await chat.getByRole('button', { name: 'Ambulancia' }).click();
  await chat.getByLabel('Nota (opcional)').fill('Nave 3');
  await chat.getByRole('button', { name: 'Enviar parte' }).click();
  await expect(chat.getByRole('button', { name: 'Nuevo parte' })).toBeVisible();

  // Ana finds it in the chat, in one line that opens with a tap, and pinned among the reports.
  await ana.getByRole('button', { name: 'Chat' }).click();
  const anaChat = ana.getByRole('region', { name: 'Chat' });
  const card = anaChat.getByRole('article').filter({ hasText: 'Parte · Incendio' });
  await expect(card.getByText('Peligros: Humo')).toBeHidden();
  await card.getByText('Parte · Incendio').click();
  await expect(card.getByText('Peligros: Humo')).toBeVisible();
  await expect(card).toContainText('Víctimas — Rojo: 1');
  await expect(card).toContainText('Peligros: Humo');
  await expect(card).toContainText('Hace falta: Ambulancia');
  await expect(card).toContainText('«Nave 3»');
  await anaChat.getByRole('tab', { name: /Partes/ }).click();
  await expect(anaChat.getByText('Suma de los partes · Víctimas — Rojo: 1')).toBeVisible();
  await expect(anaChat.getByRole('article')).toHaveCount(1);
});
