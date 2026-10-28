// Phase 2.4: a task handed from one member to another, started and finished.

import { expect, test, twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

test('a task at a point reaches its assignee, who starts and finishes it', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  // Ana picks a point of the map and leaves a task there for Berta.
  await ana.locator('.maplibregl-canvas').click({ button: 'right' });
  const point = ana.getByRole('region', { name: 'Punto del mapa' });
  await point.getByRole('button', { name: 'Más acciones' }).click();
  await point.getByRole('menuitem', { name: 'Tarea aquí' }).click();
  const anaTasks = ana.getByRole('region', { name: 'Tareas' });
  await anaTasks.getByLabel('Qué hay que hacer').fill('Revisar el almacén');
  await anaTasks.getByLabel('Para').selectOption({ label: 'Berta' });
  await expect(anaTasks.getByText(/^En el mapa:/)).toBeVisible();
  await anaTasks.getByRole('button', { name: 'Guardar' }).click();
  await expect(anaTasks.getByText('Para Berta')).toBeVisible();

  // Berta is told, and the dock counts it.
  await expect(berta.getByText('Ana te ha pasado una tarea: «Revisar el almacén»')).toBeVisible();
  await berta.getByRole('button', { name: 'Tareas: 1 para ti' }).click();
  const bertaTasks = berta.getByRole('region', { name: 'Tareas' });
  const task = bertaTasks.getByRole('listitem').filter({ hasText: 'Revisar el almacén' });
  await task.getByRole('button', { name: 'Empezar' }).click();
  await expect(task).toContainText('En curso');
  await task.getByRole('button', { name: 'Hecha' }).click();
  await expect(task).toBeHidden();
  await expect(berta.getByRole('button', { name: 'Tareas', exact: true })).toBeVisible();

  // Ana sees it done.
  await expect(anaTasks.getByText('Hechas (1)')).toBeVisible();
});

test('a common task, for anyone, is taken by whoever starts it', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Tareas' }).click();
  const anaTasks = ana.getByRole('region', { name: 'Tareas' });
  await anaTasks.getByRole('button', { name: 'Nueva tarea' }).click();
  await anaTasks.getByLabel('Tarea habitual').selectOption({ label: 'Llevar material' });
  await expect(anaTasks.getByLabel('Qué hay que hacer')).toHaveValue('Llevar material');
  await anaTasks.getByRole('button', { name: 'Guardar' }).click();
  await expect(anaTasks.getByText('Para cualquiera')).toBeVisible();

  await berta.getByRole('button', { name: 'Tareas' }).click();
  const task = berta
    .getByRole('region', { name: 'Tareas' })
    .getByRole('listitem')
    .filter({ hasText: 'Llevar material' });
  await task.getByRole('button', { name: 'Empezar' }).click();
  await expect(anaTasks.getByText('Para Berta')).toBeVisible();
});
