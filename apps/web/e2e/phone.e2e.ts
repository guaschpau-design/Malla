// What a phone's browser does to the page by itself, kept from breaking the layout.

import type { Page } from '@playwright/test';

import { createGroup, device, expect, test } from './helpers.ts';

/** The smallest text size of the fields on screen, in CSS pixels. */
function smallestFieldText(page: Page): Promise<number> {
  return page.evaluate(() => {
    const fields = document.querySelectorAll<HTMLElement>(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea',
    );
    const sizes = [...fields]
      .filter((field) => field.getClientRects().length > 0)
      .map((field) => Number.parseFloat(getComputedStyle(field).fontSize));
    return Math.min(...sizes);
  });
}

test('fields are written at 16 px or more, so that an iPhone does not zoom in on them', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', '/', { viewport: { width: 390, height: 844 } });
  await createGroup(page, 'Rescate');
  expect(await smallestFieldText(page)).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Tareas' }).click();
  await page.getByRole('button', { name: 'Nueva tarea' }).click();
  await expect(page.getByLabel('Qué hay que hacer')).toBeVisible();
  expect(await smallestFieldText(page)).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Chat' }).click();
  await expect(page.getByLabel('Mensaje')).toBeVisible();
  expect(await smallestFieldText(page)).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: /^Yo/ }).click();
  expect(await smallestFieldText(page)).toBeGreaterThanOrEqual(16);
});
