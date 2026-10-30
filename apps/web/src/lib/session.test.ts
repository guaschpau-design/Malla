import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

import { Session } from './session.svelte.ts';
import { openAppDb } from './storage/app-db.ts';

// Asking the browser to keep its storage, which Node cannot.
vi.mock('./storage/storage-space.svelte.ts', () => ({ keepStorage: () => Promise.resolve() }));

let dbCounter = 0;

async function session(): Promise<Session> {
  const started = await Session.load(await openAppDb(`session-test-${String(dbCounter++)}`));
  await started.createIdentity('Ana');
  return started;
}

describe('a practice in the session', () => {
  it('ends when another group is used, which stays active', async () => {
    const ana = await session();
    const team = await ana.createGroup('Rescate', null);
    await ana.startPractice('Práctica', 'flood', 'member');
    expect(ana.activeGroup?.practice).toBe('flood');
    await ana.activate(team.id);
    expect(ana.groups.map((group) => group.name)).toEqual(['Rescate']);
    expect(ana.activeGroupId).toBe(team.id);
  });

  it('ends when a new group is created', async () => {
    const ana = await session();
    await ana.startPractice('Práctica', 'wildfire', 'coordinator');
    const team = await ana.createGroup('Rescate', null);
    expect(ana.groups.map((group) => group.name)).toEqual(['Rescate']);
    expect(ana.activeGroupId).toBe(team.id);
  });

  it('goes back to the group used before, once ended', async () => {
    const ana = await session();
    const team = await ana.createGroup('Rescate', null);
    await ana.startPractice('Práctica', 'missing-person', 'member');
    await ana.endPractice();
    expect(ana.groups.map((group) => group.name)).toEqual(['Rescate']);
    expect(ana.activeGroupId).toBe(team.id);
  });

  it('goes back to the group used before when the app is opened again during a practice', async () => {
    const db = await openAppDb(`session-test-${String(dbCounter++)}`);
    const ana = await Session.load(db);
    await ana.createIdentity('Ana');
    const team = await ana.createGroup('Rescate', null);
    await ana.startPractice('Práctica', 'flood', 'member');
    const reopened = await Session.load(db);
    expect(reopened.groups.map((group) => group.name)).toEqual(['Rescate']);
    expect(reopened.activeGroupId).toBe(team.id);
  });
});

describe('the name of this device', () => {
  it('changes, and keeps its key, after the app is opened again', async () => {
    const db = await openAppDb(`session-test-${String(dbCounter++)}`);
    const ana = await Session.load(db);
    await ana.createIdentity('Ana');
    const node = ana.identity?.nodeId;
    await ana.renameIdentity('Ana G.');
    const reopened = await Session.load(db);
    expect(reopened.identity?.alias).toBe('Ana G.');
    expect(reopened.identity?.nodeId).toBe(node);
  });
});
