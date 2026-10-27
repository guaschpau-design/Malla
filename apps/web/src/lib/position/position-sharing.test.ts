import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

import { createGroup } from '../groups/group.ts';
import { createLocalIdentity } from '../identity/identity.ts';
import { Preference } from '../settings/preference.svelte.ts';
import { PREFERENCES } from '../settings/preferences.ts';
import { openAppDb, type AppDb } from '../storage/app-db.ts';
import { GroupFeed } from '../sync/group-feed.svelte.ts';
import { DeviceLocation } from './device-location.svelte.ts';
import { FakeGps } from './fake-gps.ts';
import { PositionSharing } from './position-sharing.svelte.ts';

let databases = 0;

/** Ana's device in a group with no server, sharing in its remembered mode. */
async function anaDevice(db?: AppDb) {
  const database = db ?? (await openAppDb(`position-sharing-${String(++databases)}`));
  const ana = createLocalIdentity('Ana', 0);
  const feed = await GroupFeed.open(database, createGroup('Rescate', null, 0), ana);
  const gps = new FakeGps();
  const mode = await Preference.load(database, PREFERENCES.positionMode);
  const sharing = new PositionSharing(mode, new DeviceLocation(gps));
  sharing.attach(feed);
  /** What the group's map shows of Ana: her last position, or that she hid it. */
  const onTheMap = () => feed.state.positions.get(ana.nodeId);
  /** The latitudes of Ana's trail, oldest first: every position published since she last hid. */
  const trail = () => feed.state.trails.get(ana.nodeId)?.points.map((point) => point.lat) ?? [];
  return { db: database, gps, sharing, onTheMap, trail };
}

describe('sharing this device’s position', () => {
  it('keeps the GPS off and publishes nothing until the user shares', async () => {
    const { gps, onTheMap } = await anaDevice();
    expect(gps.watching).toBe(0);
    gps.fix(39.47, -0.37);
    expect(onTheMap()).toBeUndefined();
  });

  it('publishes the position while sharing', async () => {
    const { gps, sharing, onTheMap } = await anaDevice();
    await sharing.setMode('sharing');
    expect(gps.watching).toBe(1);
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(onTheMap()).toMatchObject({ type: 'position', lat: 39.47, lon: -0.37 });
    });
  });

  it('once paused, publishes nothing new and leaves the last position to turn stale', async () => {
    const { gps, sharing, onTheMap, trail } = await anaDevice();
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(onTheMap()?.type).toBe('position');
    });
    await sharing.setMode('paused');
    expect(gps.watching).toBe(0);
    gps.fix(39.5, -0.4, 120_000);
    expect(onTheMap()).toMatchObject({ type: 'position', lat: 39.47, lon: -0.37 });
    // Sharing again shows that nothing was published meanwhile.
    await sharing.setMode('sharing');
    gps.fix(39.6, -0.5, 240_000);
    await vi.waitFor(() => {
      expect(trail()).toEqual([39.47, 39.6]);
    });
  });

  it('once hidden, takes the device off the group’s map and publishes nothing after', async () => {
    const { gps, sharing, onTheMap, trail } = await anaDevice();
    await sharing.setMode('sharing');
    gps.fix(39.47, -0.37);
    await vi.waitFor(() => {
      expect(onTheMap()?.type).toBe('position');
    });
    await sharing.setMode('hidden');
    expect(onTheMap()?.type).toBe('position-hidden');
    expect(gps.watching).toBe(0);
    expect(trail()).toEqual([]);
    gps.fix(39.5, -0.4, 120_000);
    // Sharing again shows that nothing was published meanwhile.
    await sharing.setMode('sharing');
    gps.fix(39.6, -0.5, 240_000);
    await vi.waitFor(() => {
      expect(trail()).toEqual([39.6]);
    });
  });

  it('remembers the choice, so sharing resumes when the app starts again', async () => {
    const first = await anaDevice();
    await first.sharing.setMode('sharing');
    const restarted = await anaDevice(first.db);
    expect(restarted.sharing.mode).toBe('sharing');
    expect(restarted.gps.watching).toBe(1);
  });
});
