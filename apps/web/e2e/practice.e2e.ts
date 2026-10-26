// Practice mode: a group of simulated teammates around this device, who talk in the chat and
// answer a roll call; ending it forgets the group.

import { device, expect, test } from './helpers.ts';

test('a practice group talks, answers the roll call and ends', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await page.getByRole('button', { name: 'Practicar con un grupo simulado' }).click();
  const card = page.getByRole('status').filter({ hasText: 'Nada sale de este dispositivo.' });
  await expect(card).toBeVisible();

  // The simulated teammates announce themselves and speak in the chat.
  await page.getByRole('button', { name: 'Chat' }).click();
  await expect(page.getByText('Llego a la zona. Monto el punto de encuentro.')).toBeVisible();
  await page.getByRole('button', { name: 'Pasar lista' }).click();
  const rollCall = page.getByRole('region', { name: 'Pase de lista' });
  await expect(rollCall).toContainText('Responden 0 de 4');
  await expect(rollCall).toContainText('Han respondido todos.', { timeout: 20_000 });

  await card.getByRole('button', { name: 'Terminar práctica' }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('button', { name: 'Grupos: Sin grupo' })).toBeVisible();
});
