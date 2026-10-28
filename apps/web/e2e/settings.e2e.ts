// Choices of the settings panel, opened from the "More" menu, that the app keeps: full screen, on
// by default and entered at the first tap of each visit, and the language.

import type { Page } from '@playwright/test';

import { device, expect, openMore, test } from './helpers.ts';

const isFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

test('the app goes full screen at the first tap, until switched off', async ({ browser }) => {
  // The first tap, on the welcome screen, already took it there.
  const page = await device(browser, 'Ana');
  await expect.poll(() => isFullscreen(page)).toBe(true);

  // A reload leaves full screen; the first tap of the visit goes back to it.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Más', exact: true })).toBeVisible();
  expect(await isFullscreen(page)).toBe(false);
  await openMore(page, 'Ajustes');
  await expect.poll(() => isFullscreen(page)).toBe(true);

  // Switched off in the settings, it stays off on the next visit.
  const settings = page.getByRole('region', { name: 'Ajustes' });
  const choice = settings.getByRole('switch', { name: 'Pantalla completa' });
  await expect(choice).toHaveAttribute('aria-checked', 'true');
  await choice.click();
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await expect(choice).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await openMore(page, 'Ajustes');
  await expect(choice).toHaveAttribute('aria-checked', 'false');
  expect(await isFullscreen(page)).toBe(false);
});

test('the language is chosen in the settings and remembered', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  // The map itself is named in the app's language, though MapLibre's own word is English.
  await expect(page.getByRole('region', { name: 'Mapa', exact: true })).toBeVisible();
  await openMore(page, 'Ajustes');
  await page
    .getByRole('region', { name: 'Ajustes' })
    .getByRole('button', { name: /Idioma/ })
    .click();
  await expect(page.getByRole('region', { name: 'Settings' })).toContainText('English');
  await expect(page.getByRole('region', { name: 'Map', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Map', exact: true })).toBeVisible();
});
