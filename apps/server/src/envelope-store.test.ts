import { mkdtempSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EnvelopeStore } from './envelope-store.ts';

const GROUP_A = new Uint8Array(16).fill(1);
const GROUP_B = new Uint8Array(16).fill(2);
const key = (n: number) => new Uint8Array(16).fill(n);
const env = (n: number) => new Uint8Array(50).fill(n);

describe('envelope store', () => {
  it('numbers each group’s envelopes from 1', () => {
    const store = new EnvelopeStore(':memory:');
    expect(store.append(GROUP_A, key(1), env(1), 0)).toEqual({ cursor: 1, isNew: true });
    expect(store.append(GROUP_A, key(2), env(2), 0)).toEqual({ cursor: 2, isNew: true });
    expect(store.append(GROUP_B, key(1), env(3), 0)).toEqual({ cursor: 1, isNew: true });
    expect(store.lastCursor(GROUP_A)).toBe(2);
  });

  it('stores an envelope once per key, however many times it is pushed', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(1), 0);
    expect(store.append(GROUP_A, key(1), env(9), 5)).toEqual({ cursor: 1, isNew: false });
    expect(store.after(GROUP_A, 0, 10)).toEqual([{ cursor: 1, key: key(1), env: env(1) }]);
  });

  it('pages through envelopes after a cursor', () => {
    const store = new EnvelopeStore(':memory:');
    for (let n = 1; n <= 5; n++) store.append(GROUP_A, key(n), env(n), 0);
    expect(store.after(GROUP_A, 2, 2).map((e) => e.cursor)).toEqual([3, 4]);
    expect(store.after(GROUP_A, 5, 2)).toEqual([]);
  });

  it('deletes envelopes older than the retention period', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(1), 1000);
    store.append(GROUP_A, key(2), env(2), 3000);
    expect(store.deleteReceivedBefore(2000)).toBe(1);
    expect(store.after(GROUP_A, 0, 10).map((e) => e.cursor)).toEqual([2]);
    // Cursors keep increasing after old envelopes are gone.
    expect(store.append(GROUP_A, key(3), env(3), 4000).cursor).toBe(3);
  });

  it('never reuses cursors, even once every envelope of a group has expired', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(1), 1000);
    store.append(GROUP_A, key(2), env(2), 1000);
    store.deleteReceivedBefore(2000);
    expect(store.lastCursor(GROUP_A)).toBe(2);
    expect(store.append(GROUP_A, key(3), env(3), 3000).cursor).toBe(3);
  });

  it('keeps what clients pushed pending for the upstream until it confirms, oldest first', () => {
    const store = new EnvelopeStore(':memory:', { upstream: true });
    store.append(GROUP_A, key(1), env(1), 0);
    store.append(GROUP_A, key(2), env(2), 0, 'upstream');
    store.append(GROUP_A, key(3), env(3), 0);
    expect(store.nextPendingUpstream(GROUP_A)?.key).toEqual(key(1));
    store.markUpstreamStored(GROUP_A, key(1));
    expect(store.nextPendingUpstream(GROUP_A)?.key).toEqual(key(3));
    store.markUpstreamStored(GROUP_A, key(3));
    expect(store.nextPendingUpstream(GROUP_A)).toBeNull();
    expect(store.groups()).toEqual([GROUP_A]);
  });

  it('keeps nothing pending on a server without an upstream', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(1), 0);
    expect(store.nextPendingUpstream(GROUP_A)).toBeNull();
  });

  it('keeps what the upstream lacks past the retention period', () => {
    const store = new EnvelopeStore(':memory:', { upstream: true });
    store.append(GROUP_A, key(1), env(1), 1000);
    store.append(GROUP_A, key(2), env(2), 1000, 'upstream');
    expect(store.deleteReceivedBefore(2000)).toBe(1);
    expect(store.nextPendingUpstream(GROUP_A)?.key).toEqual(key(1));
  });

  it('remembers how far each group was read from the upstream', () => {
    const store = new EnvelopeStore(':memory:');
    expect(store.upstreamCursor(GROUP_A)).toBe(0);
    store.setUpstreamCursor(GROUP_A, 4);
    store.setUpstreamCursor(GROUP_A, 9);
    expect(store.upstreamCursor(GROUP_A)).toBe(9);
    expect(store.upstreamCursor(GROUP_B)).toBe(0);
  });

  it('opens a database written by the first version', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'teselia-store-')), 'old.db');
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE envelopes (
        group_id BLOB NOT NULL, cursor INTEGER NOT NULL, event_key BLOB NOT NULL,
        envelope BLOB NOT NULL, received_at INTEGER NOT NULL,
        PRIMARY KEY (group_id, cursor), UNIQUE (group_id, event_key)
      ) WITHOUT ROWID;
    `);
    old.prepare('INSERT INTO envelopes VALUES (?, 1, ?, ?, 0)').run(GROUP_A, key(1), env(1));
    old.close();
    const store = new EnvelopeStore(path);
    expect(store.after(GROUP_A, 0, 10)).toHaveLength(1);
    expect(store.nextPendingUpstream(GROUP_A)).toBeNull();
    expect(store.append(GROUP_A, key(2), env(2), 0).cursor).toBe(2);
    store.close();
  });
});
