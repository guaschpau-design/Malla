// Practice mode: an exercise played by seven simulated teammates and the 112 control room around
// this device, who keep to the streets of the map, talk, take tasks, call an SOS and answer the
// user; a guide on the practice's card leads the user through five things to try, and the card
// tells how long the exercise has run and, at its end, how it went. Ending it forgets the group.

import { device, expect, practise, tapMapUntil, test } from './helpers.ts';

/** Where the tests' device stands, on the synthetic map's streets. */
const VALENCIA = '/#map=16/39.4699/-0.3763';
/** What someone says to what the user tells everyone, in one of its ways. */
const HEARD = /^(Recibido|Entendido|De acuerdo)\.$/;

test('a member is guided through a practice and given a task by its coordinator', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', VALENCIA);
  await practise(page);
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText('Persona desaparecida');
  await expect(card).toContainText('Paso 1 de 5');
  await expect(card).toContainText(/\d\d:\d\d/);

  // A teammate tapped on the map ticks off the first step: Jordi waits on the footpath 45 m
  // south-west, some 50 px away at this zoom.
  await tapMapUntil(page, { dx: -51, dy: 51 }, async () => {
    await expect(
      page.getByRole('region', { name: /^(Carmen|Jordi|Luis|Marta|Nuria|Pablo|Sara)$/ }),
    ).toBeVisible();
  });
  await expect(card).toContainText('Paso 2 de 5');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // Carmen, who coordinates, talks, answers (some seconds later, as people do) and gives the user
  // a task.
  await page.getByRole('button', { name: 'Chat' }).click();
  const chat = page.getByRole('region', { name: 'Chat' });
  await expect(chat).toContainText('Buscamos a Rosa');
  await chat.getByLabel('Mensaje').fill('Voy para allá');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText(HEARD)).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText('Paso 3 de 5');
  await chat.getByRole('button', { name: 'Cerrar' }).click();
  // Tasks for the user, or for the team they are in: the dock counts them.
  await expect(page.getByRole('button', { name: /^Tareas: \d+ para ti$/ })).toBeVisible({
    timeout: 60_000,
  });

  await card.getByRole('button', { name: 'Terminar práctica' }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('button', { name: 'Grupo: Sin grupo' })).toBeVisible();
});

test('a coordinator talks to the team, which answers', async ({ browser }) => {
  const page = await device(browser, 'Ana', VALENCIA);
  await practise(page, { situation: 'Inundación', as: 'Coordinador' });
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText('Inundación');
  await expect(card).toContainText('Forma un equipo');

  await page.getByRole('button', { name: 'Chat' }).click();
  const chat = page.getByRole('region', { name: 'Chat' });
  // The run starts once the streets around are read, which takes a moment on a busy machine.
  await expect(chat.getByText(/se ha desbordado el Barranco de Prueba/)).toBeVisible({
    timeout: 15_000,
  });
  await chat.getByLabel('Mensaje').fill('Todos al punto de encuentro');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText(HEARD)).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText('Paso 1 de 5');
});

test('an exercise ends with a report of how it went', async ({ browser }) => {
  const page = await device(browser, 'Ana', VALENCIA);
  // The page's clock is the test's, to let the exercise's twenty-five minutes go by at once.
  await page.clock.install();
  await practise(page, { as: 'Coordinador' });
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText(/\d\d:\d\d/, { timeout: 15_000 });

  // A coordinator who gave no order is told so, with the figures of the search.
  await page.clock.fastForward('25:05');
  await expect(card).toContainText('Cómo ha ido');
  await expect(card).toContainText('Rosa');
  await expect(card).toContainText(/Primera orden\s*Ninguna/);
  await expect(card).toContainText('No diste ninguna orden');
});

test('a race is drawn round the streets, with its crossings given out', async ({ browser }) => {
  const page = await device(browser, 'Ana', VALENCIA);
  await practise(page, { situation: 'Carrera popular' });
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText('Carrera popular');
  await page.getByRole('button', { name: 'Chat' }).click();
  // The run starts once the streets around are read, which takes a moment on a busy machine.
  await expect(page.getByText(/Hoy cubrimos la carrera popular/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Cerrar' }).click();
  // Tasks for the user, or for the team they are in: the dock counts them.
  await expect(page.getByRole('button', { name: /^Tareas: \d+ para ti$/ })).toBeVisible({
    timeout: 60_000,
  });
});

test('a mountain route is played where the map is, and only on a mountain', async ({ browser }) => {
  const page = await device(browser, 'Ana', VALENCIA);
  await page
    .getByRole('region', { name: 'Para empezar' })
    .getByRole('button', { name: 'Practicar sin nadie' })
    .click();
  await page.getByRole('radio', { name: 'Ruta de montaña' }).click();
  await expect(page.getByText('Se juega donde está el mapa')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar' }).click();
  // The synthetic map is flat: there is no mountain to climb.
  const card = page.getByRole('region', { name: 'Práctica' });
  await expect(card).toContainText('Aquí no hay montaña', { timeout: 15_000 });
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
  // The run starts once the streets around are read, which takes a moment on a busy machine.
  await expect(page.getByText('Incendio forestal al norte.')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/#map=9\/39\.47\/-0\.37$/);
});
