// Practice mode: a situation played by four simulated teammates around this device, who keep to
// the streets of the map, talk, take tasks, call an SOS and answer the user; a guide on the
// practice's card leads the user through five things to try. Ending it forgets the group.

import { device, expect, practise, tapMapUntil, test } from './helpers.ts';

/** Where the tests' device stands, on the synthetic map's streets. */
const VALENCIA = '/#map=16/39.4699/-0.3763';

test('a member is guided through a practice and given a task by its coordinator', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', VALENCIA);
  await practise(page);
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText('Persona desaparecida');
  await expect(card).toContainText('Paso 1 de 5');

  // A teammate tapped on the map ticks off the first step: Jordi waits on the footpath 45 m
  // south-west, some 50 px away at this zoom.
  await tapMapUntil(page, { dx: -51, dy: 51 }, async () => {
    await expect(page.getByRole('region', { name: /^(Carmen|Jordi|Luis|Marta)$/ })).toBeVisible();
  });
  await expect(card).toContainText('Paso 2 de 5');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // Carmen, who coordinates, talks, answers and gives the user a task.
  await page.getByRole('button', { name: 'Chat' }).click();
  const chat = page.getByRole('region', { name: 'Chat' });
  await expect(chat).toContainText('Buscamos a Rosa');
  await chat.getByLabel('Mensaje').fill('Voy para allá');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText('Recibido.')).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText('Paso 3 de 5');
  await chat.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: /^Tareas/ })).toContainText('1', {
    timeout: 60_000,
  });

  await card.getByRole('button', { name: 'Terminar práctica' }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('button', { name: 'Grupos: Sin grupo' })).toBeVisible();
});

test('a coordinator’s roll call is answered by the whole team', async ({ browser }) => {
  const page = await device(browser, 'Ana', VALENCIA);
  await practise(page, { situation: 'Inundación', as: 'Coordinador' });
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText('Inundación');
  await expect(card).toContainText('Forma un equipo');

  await page.getByRole('button', { name: 'Chat' }).click();
  await expect(page.getByText('El barranco se ha desbordado.')).toBeVisible();
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.getByRole('menuitem', { name: 'Pasar lista' }).click();
  const rollCall = page.getByRole('region', { name: 'Pase de lista' });
  await expect(rollCall).toContainText('Responden 0 de 4');
  await expect(rollCall).toContainText('Han respondido todos.', { timeout: 20_000 });
  await expect(card).toContainText('Paso 1 de 5');
});

test('a practice started on the wide view the map opens on brings the teammates into view', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await practise(page);
  // The teammates walk a few hundred metres around the middle of the map: it closes in on them.
  await expect(page).toHaveURL(/#map=1[3-5](\.\d+)?\/40\.\d+\/-3\.\d+$/);
});

test('a practice leaves alone the view the address gave', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/#map=9/39.47/-0.37');
  await practise(page, { situation: 'Incendio forestal' });
  await page.getByRole('button', { name: 'Chat' }).click();
  await expect(page.getByText('Incendio forestal al norte.')).toBeVisible();
  await expect(page).toHaveURL(/#map=9\/39\.47\/-0\.37$/);
});
