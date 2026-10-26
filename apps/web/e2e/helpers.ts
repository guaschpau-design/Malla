import { expect, type Browser, type Page } from '@playwright/test';

const VALENCIA = { latitude: 39.4699, longitude: -0.3763 };

/** Goes through the first-launch dialog, which every new browser profile shows. */
export async function chooseAlias(page: Page, alias: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Te damos la bienvenida a Tesel' });
  await dialog.getByLabel('Tu nombre en el grupo').fill(alias);
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog).toBeHidden();
}

/** A new browser profile, located in Valencia, that has chosen its alias. */
export async function device(browser: Browser, alias: string, path = '/'): Promise<Page> {
  const context = await browser.newContext({ permissions: ['geolocation'], geolocation: VALENCIA });
  const page = await context.newPage();
  await page.goto(path);
  await chooseAlias(page, alias);
  return page;
}

/**
 * Ana creates a group on the test server and Berta joins it with the invitation link.
 * Both end synced, with every panel closed.
 */
export async function twoMembers(
  browser: Browser,
  path = '/',
): Promise<{ ana: Page; berta: Page }> {
  const ana = await device(browser, 'Ana', path);
  await ana.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await ana.getByLabel('Nombre del grupo').fill('Rescate Valencia');
  await ana.getByRole('button', { name: 'Crear', exact: true }).click();
  await ana.getByRole('button', { name: 'Invitar' }).click();
  const link = await ana.getByLabel('Enlace de invitación').inputValue();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ana.getByTitle('Sincronizado')).toBeVisible();

  const berta = await device(browser, 'Berta', path);
  await berta.goto(link);
  await berta.getByRole('dialog').getByRole('button', { name: 'Unirme' }).click();
  await expect(berta.getByTitle('Sincronizado')).toBeVisible();
  // The invitation link replaced the map view; put Berta's map where Ana's is.
  await berta.goto(path);
  await expect(berta.getByTitle('Sincronizado')).toBeVisible();
  return { ana, berta };
}
