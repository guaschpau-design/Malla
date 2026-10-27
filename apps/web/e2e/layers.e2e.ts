import { device, expect, storedSetting, test } from './helpers.ts';

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
  await expect.poll(() => storedSetting(page, 'hiddenLayers')).toEqual(['trails']);

  await page.reload();
  await openLayers();
  await expect(page.getByRole('switch', { name: 'Recorridos' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Miembros' })).toBeChecked();
});
