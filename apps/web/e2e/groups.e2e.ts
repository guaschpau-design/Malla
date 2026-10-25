// Day 2: a coordinator creates a group and a second device joins it with the invitation.

import { expect, test, type Page } from '@playwright/test';

import { chooseAlias } from './helpers.ts';

async function invitationLink(page: Page, role: 'miembro' | 'coordinador'): Promise<string> {
  await page.getByRole('button', { name: 'Invitar' }).click();
  await page.getByLabel('Se une como').selectOption({ label: role });
  await expect(page.getByRole('img', { name: 'Código QR de la invitación' })).toBeVisible();
  const link = await page.getByLabel('Enlace de invitación').inputValue();
  await page.getByRole('button', { name: 'Volver' }).click();
  return link;
}

test('a second device joins a group through its invitation link', async ({ browser }) => {
  const coordinator = await (await browser.newContext()).newPage();
  await coordinator.goto('/');
  await chooseAlias(coordinator, 'Ana');
  await coordinator.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await coordinator.getByLabel('Nombre del grupo').fill('Rescate Valencia');
  await coordinator.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(coordinator.getByRole('button', { name: 'Grupos: Rescate Valencia' })).toBeVisible();
  const memberLink = await invitationLink(coordinator, 'miembro');
  expect(new URL(memberLink).pathname).toBe('/join');

  const member = await (await browser.newContext()).newPage();
  await member.goto(memberLink);
  await expect(
    member.getByText('Te han invitado a «Rescate Valencia».', { exact: false }),
  ).toBeVisible();
  await chooseAlias(member, 'Berta');
  // The secret must not stay in the address bar or the history.
  expect(member.url()).not.toContain('join');

  const joinDialog = member.getByRole('dialog', { name: 'Unirse a un grupo' });
  await expect(joinDialog.getByText('¿Unirte a «Rescate Valencia» como miembro?')).toBeVisible();
  await joinDialog.getByRole('button', { name: 'Unirme' }).click();
  await expect(member.getByText('Te has unido a «Rescate Valencia».')).toBeVisible();

  // Membership survives a restart, and members do not invite.
  await member.reload();
  await member.getByRole('button', { name: 'Grupos: Rescate Valencia' }).click();
  await expect(member.getByText('miembro', { exact: true })).toBeVisible();
  await expect(member.getByRole('button', { name: 'Invitar' })).toHaveCount(0);

  // A coordinator invitation, pasted, promotes the member.
  const coordinatorLink = await invitationLink(coordinator, 'coordinador');
  await member.getByLabel('Enlace de invitación').fill(coordinatorLink);
  await member.getByRole('button', { name: 'Unirme' }).click();
  await member
    .getByRole('dialog', { name: 'Unirse a un grupo' })
    .getByRole('button', { name: 'Unirme' })
    .click();
  await expect(member.getByText('Ahora coordinas «Rescate Valencia».')).toBeVisible();
});

test('a damaged invitation is reported, not silently ignored', async ({ page }) => {
  await page.goto('/join#AAAA');
  await chooseAlias(page, 'Carla');
  await expect(
    page.getByText('Esta invitación está dañada o incompleta.', { exact: false }),
  ).toBeVisible();
});
