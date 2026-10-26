import { device, expect, test } from './helpers.ts';

test('a hidden map layer stays hidden after the app restarts', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  const openLayers = async () => {
    await page.getByRole('button', { name: 'Capas del mapa' }).click();
  };
  await openLayers();
  const trails = page.getByRole('switch', { name: 'Recorridos' });
  await expect(trails).toBeChecked();
  await trails.click();
  await expect(trails).not.toBeChecked();
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
  await expect(page.getByRole('switch', { name: 'Recorridos' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Miembros' })).toBeChecked();
});
