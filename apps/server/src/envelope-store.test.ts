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
    expect(store.after(GROUP_A, 0, 10)).toEqual([{ cursor: 1, env: env(1) }]);
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
});
