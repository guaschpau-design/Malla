// Choices of the "More" menu that the app keeps: full screen, on by default and entered at the
// first tap of each visit, and the language.

import type { Page } from '@playwright/test';

import { device, expect, test } from './helpers.ts';

const isFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

test('the app goes full screen at the first tap, until switched off', async ({ browser }) => {
  // The first tap, on the welcome screen, already took it there.
  const page = await device(browser, 'Ana');
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

test('the language is chosen in the "More" menu and remembered', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  // The map itself is named in the app's language, though MapLibre's own word is English.
  await expect(page.getByRole('region', { name: 'Mapa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('menuitem', { name: /Idioma/ }).click();
  await expect(page.getByRole('menuitem', { name: /Language/ })).toContainText('English');
  await expect(page.getByRole('region', { name: 'Map', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Map', exact: true })).toBeVisible();
});
