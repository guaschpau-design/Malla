import { expect, test } from '@playwright/test';

import { device } from './helpers.ts';

test('a hidden map layer stays hidden after the app restarts', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  const openLayers = async () => {
    await page.getByRole('button', { name: 'Capas del mapa' }).click();
  };
  await openLayers();
  const trails = page.getByRole('checkbox', { name: /^Recorridos/ });
  await expect(trails).toBeChecked();
  await trails.uncheck();
  // The choice is stored a moment after the tap; restart only once it is.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const open = indexedDB.open('tesel');
            open.onsuccess = () => {
              const read = open.result
                .transaction('settings')
                .objectStore('settings')
                .get('hiddenLayers');
              read.onsuccess = () => {
                resolve(read.result);
              };
            };
          }),
      ),
    )
    .toEqual(['trails']);

  await page.reload();
  await openLayers();
  await expect(page.getByRole('checkbox', { name: /^Recorridos/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Miembros/ })).toBeChecked();
});
