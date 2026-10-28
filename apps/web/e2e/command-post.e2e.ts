// Day 6: a member who cannot reach the group's server syncs through its command post, which
// replicates the server (ADR-0018).

import { expect, test, twoMembers } from './helpers.ts';
import { SERVER_URL } from './ports.ts';

test('a member cut off from the server keeps talking to the group through the command post', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser);

  // Berta loses the server, as on the scene with no internet; only the post answers.
  await berta.routeWebSocket(`${SERVER_URL.replace('http', 'ws')}/v1/ws`, (socket) => {
    void socket.close();
  });
  await berta.reload();
  await expect(berta.getByTitle('Conectado a un puesto de mando')).toBeVisible();

  await ana.getByRole('button', { name: 'Chat' }).click();
  await ana.getByLabel('Mensaje').fill('¿Llegáis al puesto?');
  await ana.getByRole('button', { name: 'Enviar', exact: true }).click();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Llegáis al puesto?')).toBeVisible();

  await berta.getByLabel('Mensaje').fill('Sí, desde el puesto');
  await berta.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(ana.getByText('Sí, desde el puesto')).toBeVisible();
});
