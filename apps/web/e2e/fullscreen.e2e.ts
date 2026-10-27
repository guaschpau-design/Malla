// Full screen in a browser tab: chosen on first launch, resumed at the first tap of a later visit
// and switched in the "More" menu.

import type { Page } from '@playwright/test';

import { expect, test } from './helpers.ts';

const isFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

test('full screen is chosen on first launch and remembered', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Te damos la bienvenida a Tesel' });
  await dialog.getByLabel('Tu nombre en el grupo').fill('Ana');
  const choice = dialog.getByRole('switch', { name: /Pantalla completa/ });
  await expect(choice).toHaveAttribute('aria-checked', 'false');
  await choice.click();
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => isFullscreen(page)).toBe(true);

  // A reload leaves full screen; the first tap of the visit goes back to it.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Más' })).toBeVisible();
  expect(await isFullscreen(page)).toBe(false);
  await page.getByRole('button', { name: 'Más' }).click();
  await expect.poll(() => isFullscreen(page)).toBe(true);

  // Switched off in the menu, it stays off on the next visit.
  const item = page.getByRole('menuitemcheckbox', { name: 'Pantalla completa' });
  await expect(item).toHaveAttribute('aria-checked', 'true');
  await item.click();
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Más' }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Pantalla completa' })).toBeVisible();
  expect(await isFullscreen(page)).toBe(false);
});
