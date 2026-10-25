import { expect, type Page } from '@playwright/test';

/** Goes through the first-launch dialog, which every new browser profile shows. */
export async function chooseAlias(page: Page, alias: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Te damos la bienvenida a Teselia' });
  await dialog.getByLabel('Tu nombre en el grupo').fill(alias);
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog).toBeHidden();
}
