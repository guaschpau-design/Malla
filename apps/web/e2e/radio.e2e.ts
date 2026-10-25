// Day 5: the radio panel. Pairing needs a real radio, so this only checks what can be checked
// without one; the radio path itself is covered by unit tests with radios in memory.

import { expect, test } from '@playwright/test';

import { device } from './helpers.ts';

test('the radio panel offers to pair a radio, or explains why it cannot', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: /^Radio:/ }).click();
  const panel = page.getByRole('region', { name: 'Radio LoRa' });
  const hasBluetooth = await page.evaluate(() => 'bluetooth' in navigator);
  if (hasBluetooth) {
    await expect(panel.getByRole('button', { name: 'Conectar radio' })).toBeVisible();
  } else {
    await expect(panel).toContainText('Este navegador no puede usar Bluetooth');
  }
});
