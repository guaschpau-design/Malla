import { mkdtempSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fromBase64url } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { EnvelopeStore } from './envelope-store.ts';

const GROUP_A = new Uint8Array(16).fill(1);
const GROUP_B = new Uint8Array(16).fill(2);
const key = (n: number) => new Uint8Array(16).fill(n);
const env = (n: number) => new Uint8Array(50).fill(n);
const tempPath = () => join(mkdtempSync(join(tmpdir(), 'tesel-store-')), 'tesel.db');

describe('envelope store', () => {
  it('numbers each group’s envelopes from 1', () => {
    const store = new EnvelopeStore(':memory:');
    expect(store.append(GROUP_A, key(1), env(1), 0)).toEqual({ cursor: 1, isNew: true });
    expect(store.append(GROUP_A, key(2), env(2), 0)).toEqual({ cursor: 2, isNew: true });
    expect(store.append(GROUP_B, key(1), env(3), 0)).toEqual({ cursor: 1, isNew: true });
    expect(store.lastCursor(GROUP_A)).toBe(2);
  });

  it('stores an envelope once, however many times it is pushed', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(1), 0);
    expect(store.append(GROUP_A, key(1), env(1), 5)).toEqual({ cursor: 1, isNew: false });
    expect(store.after(GROUP_A, 0, 10)).toEqual([{ cursor: 1, key: key(1), env: env(1) }]);
  });

  it('stores a different envelope under a known key too, so junk cannot hide the real one', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(9), 0);
    expect(store.append(GROUP_A, key(1), env(1), 5)).toEqual({ cursor: 2, isNew: true });
    expect(store.after(GROUP_A, 0, 10).map((e) => e.env)).toEqual([env(9), env(1)]);
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

  it('forgets a group whose envelopes have all expired, but never reuses its cursors', () => {
    const store = new EnvelopeStore(':memory:');
    store.append(GROUP_A, key(1), env(1), 1000);
    store.append(GROUP_A, key(2), env(2), 1000);
    store.append(GROUP_B, key(1), env(1), 3000);
    store.deleteReceivedBefore(2000);
    expect(store.lastCursor(GROUP_A)).toBe(0);
    expect(store.lastCursor(GROUP_B)).toBe(1);
    expect(store.append(GROUP_A, key(3), env(3), 3000).cursor).toBe(3);
  });

  it('keeps counting on from forgotten groups after a restart', () => {
    const path = tempPath();
    const store = new EnvelopeStore(path);
    for (let n = 1; n <= 4; n++) store.append(GROUP_A, key(n), env(n), 1000);
    store.deleteReceivedBefore(2000);
    store.close();
    const reopened = new EnvelopeStore(path);
    expect(reopened.append(GROUP_A, key(5), env(5), 3000).cursor).toBe(5);
    reopened.close();
  });

  it('keeps what clients pushed pending for the upstream until it confirms, oldest first', () => {
    const store = new EnvelopeStore(':memory:', { upstream: true });
    store.append(GROUP_A, key(1), env(1), 0);
    store.append(GROUP_A, key(2), env(2), 0, 'upstream');
    store.append(GROUP_A, key(3), env(3), 0);
    store.append(GROUP_B, key(4), env(4), 1);
    expect(store.groupsPendingUpstream()).toEqual([GROUP_B, GROUP_A]);
    expect(store.nextPendingUpstream(GROUP_A)?.key).toEqual(key(1));
    store.markUpstreamStored(GROUP_A, 1);
    expect(store.nextPendingUpstream(GROUP_A)?.key).toEqual(key(3));
    store.markUpstreamStored(GROUP_A, 3);
    expect(store.nextPendingUpstream(GROUP_A)).toBeNull();
    expect(store.groupsPendingUpstream()).toEqual([GROUP_B]);
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

  it('remembers how far each group was read from the upstream, and from which store', () => {
    const store = new EnvelopeStore(':memory:');
    expect(store.upstreamCursor(GROUP_A)).toBe(0);
    expect(store.upstreamStore(GROUP_A)).toBeNull();
    store.setUpstreamCursor(GROUP_A, 4);
    store.setUpstreamPosition(GROUP_A, 9, 'store-1');
    store.setUpstreamCursor(GROUP_A, 10);
    expect(store.upstreamCursor(GROUP_A)).toBe(10);
    expect(store.upstreamStore(GROUP_A)).toBe('store-1');
    expect(store.upstreamCursor(GROUP_B)).toBe(0);
  });

  it('reads a group again from the start, and gives everything back, when the upstream changes', () => {
    const store = new EnvelopeStore(':memory:', { upstream: true });
    store.append(GROUP_A, key(1), env(1), 0, 'upstream');
    store.append(GROUP_A, key(2), env(2), 0);
    store.markUpstreamStored(GROUP_A, 2);
    store.setUpstreamPosition(GROUP_A, 7, 'store-1');
    store.restartUpstream(GROUP_A, 'store-2');
    expect(store.upstreamCursor(GROUP_A)).toBe(0);
    expect(store.upstreamStore(GROUP_A)).toBe('store-2');
    expect(store.nextPendingUpstream(GROUP_A)?.cursor).toBe(1);
    store.markUpstreamStored(GROUP_A, 1);
    expect(store.nextPendingUpstream(GROUP_A)?.cursor).toBe(2);
  });

  it('keeps its identity across restarts, and a new database gets a new one', () => {
    const path = tempPath();
    const store = new EnvelopeStore(path);
    const id = store.id;
    store.close();
    const reopened = new EnvelopeStore(path);
    expect(reopened.id).toBe(id);
    expect(fromBase64url(id)).toHaveLength(16);
    expect(new EnvelopeStore(':memory:').id).not.toBe(id);
    reopened.close();
  });

  it('reports whether its database answers', () => {
    const store = new EnvelopeStore(':memory:');
    expect(store.isAvailable()).toBe(true);
    store.close();
    expect(store.isAvailable()).toBe(false);
  });

  it('opens a database written by the first version', () => {
    const path = tempPath();
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

  it('upgrades a database written before schema versions were recorded', () => {
    const path = tempPath();
    const old = new DatabaseSync(path);
    old.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE envelopes (
        group_id BLOB NOT NULL, cursor INTEGER NOT NULL, event_key BLOB NOT NULL,
        envelope BLOB NOT NULL, received_at INTEGER NOT NULL,
        pending_up INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (group_id, cursor), UNIQUE (group_id, event_key)
      ) WITHOUT ROWID;
      CREATE INDEX envelopes_received_at ON envelopes (received_at);
      CREATE TABLE group_cursors (group_id BLOB NOT NULL PRIMARY KEY, cursor INTEGER NOT NULL) WITHOUT ROWID;
      CREATE TABLE upstream_cursors (group_id BLOB NOT NULL PRIMARY KEY, cursor INTEGER NOT NULL) WITHOUT ROWID;
    `);
    old.prepare('INSERT INTO envelopes VALUES (?, 1, ?, ?, 0, 1)').run(GROUP_A, key(1), env(1));
    old.prepare('INSERT INTO group_cursors VALUES (?, 1)').run(GROUP_A);
    old.prepare('INSERT INTO upstream_cursors VALUES (?, 5)').run(GROUP_A);
    old.close();

    const store = new EnvelopeStore(path, { upstream: true });
    expect(store.append(GROUP_A, key(1), env(1), 0)).toEqual({ cursor: 1, isNew: false });
    expect(store.append(GROUP_A, key(1), env(2), 0)).toEqual({ cursor: 2, isNew: true });
    expect(store.nextPendingUpstream(GROUP_A)?.cursor).toBe(1);
    expect(store.upstreamCursor(GROUP_A)).toBe(5);
    expect(store.upstreamStore(GROUP_A)).toBeNull();
    store.close();

    const db = new DatabaseSync(path);
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
    expect(db.prepare('PRAGMA auto_vacuum').get()).toEqual({ auto_vacuum: 2 });
    db.close();
  });

  it('refuses a database written by a newer server', () => {
    const path = tempPath();
    const newer = new DatabaseSync(path);
    newer.exec('PRAGMA user_version = 99');
    newer.close();
    expect(() => new EnvelopeStore(path)).toThrow(/newer/);
  });
});
