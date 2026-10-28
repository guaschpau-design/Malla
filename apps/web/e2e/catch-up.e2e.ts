// A device that has been away for hours catches up with what its group did meanwhile in seconds,
// not minutes: envelopes are stored and applied in batches (ARCHITECTURE.md §4.1). The relay is
// played by the test, so that thousands of envelopes can wait for the device at once, past the
// rate limits a real server applies to pushes.

import {
  deriveGroupKeys,
  encodeEvent,
  encodeRelayMessage,
  eventKey,
  parseClientMessage,
  sealEnvelope,
  type ServerMessage,
} from '@tesel/protocol';
import type { Page } from '@playwright/test';
import { syntheticOperation } from '@tesel/simulator';

import { device, expect, test } from './helpers.ts';

const MEMBERS = 50;
const EVENTS = 5000;
/**
 * Before batching this took about ten minutes; now it takes seconds, about twenty on a busy
 * machine. The bound lies far from both, so that load never fails it and a return to one envelope
 * at a time always does.
 */
const CATCH_UP_LIMIT_MS = 120_000;
/** Time for the rest of the test: the device, its group and the backlog. */
const SETUP_MS = 60_000;

test('a device catches up with thousands of waiting events in seconds', async ({ browser }) => {
  test.setTimeout(SETUP_MS + CATCH_UP_LIMIT_MS);
  const ana = await device(browser, 'Ana');
  await ana.getByRole('button', { name: 'Grupos: Sin grupo' }).click();
  await ana.getByRole('button', { name: 'Crear grupo' }).click();
  await ana.getByLabel('Nombre del grupo').fill('Operativo largo');
  await ana.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(ana.getByTitle('Conectado al servidor del grupo')).toBeVisible();
  const backlog = backlogFor(await groupSecret(ana));
  // The same server as before, as its store identity shows: the device reads on from its cursor.
  const store = await serverStore(ana);

  // From now on the relay is the test: it answers a join with the whole backlog.
  await ana.context().routeWebSocket(/\/v1\/ws$/, (relay) => {
    relay.onMessage((text) => {
      const message = parseClientMessage(String(text));
      if (!message.ok || message.value.t !== 'join') return;
      for (const envelope of backlog) relay.send(encodeRelayMessage(envelope));
      relay.send(
        encodeRelayMessage({
          t: 'synced',
          cursor: backlog.length,
          store,
        }),
      );
    });
  });

  const start = Date.now();
  await ana.reload();
  await expect
    .poll(() => storedEvents(ana), { timeout: CATCH_UP_LIMIT_MS, intervals: [250] })
    .toBeGreaterThanOrEqual(EVENTS);
  expect(Date.now() - start).toBeLessThan(CATCH_UP_LIMIT_MS);
  await expect(ana.getByTitle('Conectado al servidor del grupo')).toBeVisible();
  await ana.getByRole('button', { name: 'Grupos: Operativo largo' }).click();
  await expect(ana.getByRole('list', { name: `Miembros (${String(MEMBERS + 1)})` })).toBeVisible();
});

/** Fifty members sharing their position every ten seconds, as the relay would send them. */
function backlogFor(secret: Uint8Array): ServerMessage[] {
  const keys = deriveGroupKeys(secret);
  const { events } = syntheticOperation({
    members: MEMBERS,
    events: EVENTS,
    positionEvery: 10,
    start: Math.floor(Date.now() / 1000) - 8 * 3600,
    center: { lat: 39.47, lon: -0.37 },
  });
  return events.map((event, index) => {
    const bytes = encodeEvent(event);
    if (!bytes.ok) throw new Error(bytes.error.detail);
    return {
      t: 'env',
      cursor: index + 1,
      key: eventKey(keys, event),
      env: sealEnvelope(keys, bytes.value),
    };
  });
}

/** The secret of the device's only group, as an invitation would carry it. */
async function groupSecret(page: Page): Promise<Uint8Array> {
  const secret = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open('tesel');
      open.onsuccess = () => {
        resolve(open.result);
      };
    });
    const groups = await new Promise<{ secret: Uint8Array }[]>((resolve) => {
      const req = db.transaction('groups').objectStore('groups').getAll();
      req.onsuccess = () => {
        resolve(req.result as { secret: Uint8Array }[]);
      };
    });
    db.close();
    return Array.from(groups[0]?.secret ?? []);
  });
  return Uint8Array.from(secret);
}

/** How many events the device has stored for its group, its own included. */
function storedEvents(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open('tesel');
      open.onsuccess = () => {
        resolve(open.result);
      };
    });
    const count = await new Promise<number>((resolve) => {
      const req = db.transaction('events').objectStore('events').count();
      req.onsuccess = () => {
        resolve(req.result);
      };
    });
    db.close();
    return count;
  });
}

/** The store identity of the group's server, as the device saved it with its cursor. */
async function serverStore(page: Page): Promise<string> {
  const store = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('tesel');
        open.onsuccess = () => {
          const read = open.result.transaction('cursors').objectStore('cursors').getAll();
          read.onsuccess = () => {
            open.result.close();
            resolve((read.result[0] as { store?: unknown } | undefined)?.store);
          };
        };
      }),
  );
  if (typeof store !== 'string') throw new Error('the device has not synced with its server');
  return store;
}
