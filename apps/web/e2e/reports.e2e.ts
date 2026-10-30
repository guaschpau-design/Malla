// Situation reports: written from "Add", pinned in the chat's own tab, and seen by the whole group.

import { expect, test, twoMembers } from './helpers.ts';

test('a situation report is sent from Add and pinned for the group', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);

  // Berta reports a fire with one casualty.
  await berta.getByRole('button', { name: 'Añadir' }).click();
  await berta.getByRole('menuitem', { name: 'Parte' }).click();
  const form = berta.getByRole('region', { name: 'Nuevo parte' });
  await form.getByRole('radio', { name: 'Incendio' }).click();
  await form.getByText('Víctimas', { exact: true }).click();
  await form.getByRole('button', { name: 'Rojo: uno más' }).click();
  await form.getByText('Peligros', { exact: true }).click();
  await form.getByRole('button', { name: 'Humo' }).click();
  await form.getByText('Hace falta', { exact: true }).click();
  await form.getByRole('button', { name: 'Ambulancia' }).click();
  await form.getByLabel('Nota (opcional)').fill('Nave 3');
  await form.getByRole('button', { name: 'Enviar parte' }).click();
  // Sent, it shows pinned among the reports.
  const chat = berta.getByRole('region', { name: 'Chat' });
  await expect(chat.getByRole('article').filter({ hasText: 'Parte · Incendio' })).toBeVisible();

  // Ana is told there is something new in the chat.
  await expect(ana.getByRole('button', { name: 'Chat: 1 nuevo' })).toBeVisible();

  // Ana finds it in the chat, in one line that opens with a tap, and pinned among the reports.
  await ana.getByRole('button', { name: 'Chat: 1 nuevo' }).click();
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
  // Once read, nothing is new any more.
  await anaChat.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ana.getByRole('button', { name: 'Chat', exact: true })).toBeVisible();
});
