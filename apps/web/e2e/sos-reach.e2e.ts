import { createGroup, device, expect, openMore, test } from './helpers.ts';

// Asking for help must never wait for something to be closed first, on the smallest phones too.
test('the SOS button stays on screen and usable over a panel and while measuring, at 320 px', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', '/', { viewport: { width: 320, height: 568 } });
  await createGroup(page, 'Rescate');
  await page
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Cerrar' })
    .click();
  const sos = page.getByRole('button', { name: 'SOS', exact: true });

  await openMore(page, 'Mapas sin conexión');
  await expect(page.getByRole('region', { name: 'Mapas sin conexión' })).toBeVisible();
  await expect(sos).toBeInViewport({ ratio: 1 });
  await sos.click();
  const dialog = page.getByRole('dialog', { name: 'Enviar un SOS' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();

  await page
    .getByRole('region', { name: 'Mapas sin conexión' })
    .getByRole('button', { name: 'Cerrar' })
    .click();
  await openMore(page, 'Medir distancias');
  await expect(sos).toBeInViewport({ ratio: 1 });
  await sos.click();
  await expect(dialog).toBeVisible();
});
