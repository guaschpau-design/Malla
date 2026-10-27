import { test as base, expect, type Browser, type Page } from '@playwright/test';

export { expect };

/**
 * Playwright's `test`, closing every browser context a test opened once it ends. Tests open their
 * devices with `browser.newContext()`, which Playwright leaves open until the browser closes:
 * without this, every map of the suite would keep drawing until the end, slowing the last tests.
 */
export const test = base.extend<{ closeDevices: undefined }>({
  closeDevices: [
    async ({ browser }, use) => {
      await use(undefined);
      await Promise.all(browser.contexts().map((context) => context.close()));
    },
    { auto: true },
  ],
});

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
  await ana.getByRole('button', { name: 'Crear grupo' }).click();
  await ana.getByLabel('Nombre del grupo').fill('Rescate Valencia');
  await ana.getByRole('button', { name: 'Crear', exact: true }).click();
  await ana.getByRole('button', { name: 'Invitar' }).click();
  const link = await ana.getByLabel('Enlace de invitación').inputValue();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ana.getByTitle('Conectado al servidor del grupo')).toBeVisible();

  const berta = await device(browser, 'Berta', path);
  await berta.goto(link);
  await berta.getByRole('dialog').getByRole('button', { name: 'Unirme' }).click();
  // A new member first chooses a relay (protocol §8.3), which can take a few seconds when the
  // machine running the whole suite is busy.
  await expect(berta.getByTitle('Conectado al servidor del grupo')).toBeVisible({
    timeout: 15_000,
  });
  // The invitation link replaced the map view; put Berta's map where Ana's is.
  await berta.goto(path);
  await expect(berta.getByTitle('Conectado al servidor del grupo')).toBeVisible();
  return { ana, berta };
}

/** Chooses how this device shares its position, in the "Me" panel, and closes the panel. */
export async function shareAs(
  page: Page,
  choice: 'Compartir' | 'Pausar' | 'Ocultar',
): Promise<void> {
  await page.getByRole('button', { name: /^Yo/ }).click();
  const panel = page.getByRole('region', { name: 'Yo' });
  await panel.getByRole('radio', { name: new RegExp(`^${choice}`) }).click();
  await expect(panel.getByRole('radio', { name: new RegExp(`^${choice}`) })).toBeChecked();
  await panel.getByRole('button', { name: 'Cerrar' }).click();
}

/**
 * Waits until the map has stopped moving and drawn everything it was loading, as MapView tells
 * through aria-busy: what is drawn then is what a tap finds.
 */
export async function mapIdle(page: Page): Promise<void> {
  await expect(page.locator('.maplibregl-map')).toHaveAttribute('aria-busy', 'false');
}

/** Taps the map `dx`, `dy` pixels from its centre, once it is idle. */
export async function tapMap(page: Page, dx = 0, dy = 0): Promise<void> {
  await mapIdle(page);
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('no map');
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}

/**
 * Taps the map `dx`, `dy` pixels from its centre until `expectation` holds. For what reaches the
 * map a while after the step that makes it — another member's event, or our own once it is stored
 * — which nothing else on the page announces. Each tap waits for the map to be idle, so a tap that
 * misses means the object had not arrived, not that the map was still drawing it.
 */
export async function tapMapUntil(
  page: Page,
  { dx = 0, dy = 0 }: { dx?: number; dy?: number },
  expectation: () => Promise<void>,
): Promise<void> {
  await expect(async () => {
    await tapMap(page, dx, dy);
    await expectation();
  }).toPass({ timeout: 15_000 });
}

/** Opens one of the items of the dock's "More" menu. */
export async function openMore(page: Page, item: string): Promise<void> {
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** A setting as stored on the device: a choice is stored a moment after the tap. */
export function storedSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (setting) =>
      new Promise((resolve) => {
        const open = indexedDB.open('tesel');
        open.onsuccess = () => {
          const read = open.result.transaction('settings').objectStore('settings').get(setting);
          read.onsuccess = () => {
            resolve(read.result);
          };
        };
      }),
    key,
  );
}
