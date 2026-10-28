// Encrypted envelopes per group (docs/protocol.md §8), stored in SQLite through node:sqlite.
// The server never sees anything but group IDs, event keys and ciphertext. A command post also
// remembers what its upstream still lacks and how far it has read from it (§8.2). The schema and
// its upgrades live in store-schema.ts.

import { DatabaseSync, type StatementSync } from 'node:sqlite';

import { toBase64url } from '@tesel/protocol';

import { envelopeDigest, openSchema, transaction } from './store-schema.ts';

export interface StoredEnvelope {
  readonly cursor: number;
  readonly key: Uint8Array;
  readonly env: Uint8Array;
}

/** Who handed the envelope to this server: one of its clients, or its upstream (§8.2). */
export type EnvelopeSource = 'client' | 'upstream';

export interface AppendResult {
  readonly cursor: number;
  /** False if the group already had this very envelope under this key. */
  readonly isNew: boolean;
}

// Statements used in more than one place.
const STORE_INFO = 'SELECT id, pruned_cursor FROM store_info';
const LAST_CURSOR = 'SELECT cursor FROM group_cursors WHERE group_id = ?';
const UPSTREAM = 'SELECT cursor, store FROM upstream_cursors WHERE group_id = ?';
const SET_UPSTREAM_POSITION =
  'INSERT INTO upstream_cursors (group_id, cursor, store) VALUES (?, ?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor, store = excluded.store';

export class EnvelopeStore {
  /** The store identity (§8), base64url: created with the database and kept in it. */
  readonly id: string;

  readonly #db: DatabaseSync;
  readonly #tracksUpstream: boolean;
  /** The cursor a group without a cursor row counts on from (see store_info). */
  #prunedCursor: number;

  /** Statements prepared once, at first use, by their SQL. */
  readonly #statements = new Map<string, StatementSync>();

  /**
   * `path` is a file, or `:memory:` for tests. A server with an upstream (a command post) keeps
   * what its clients push pending until the upstream confirms it; one without keeps nothing
   * pending, so turning a server into a command post later uploads only what arrives from then on.
   */
  constructor(path: string, options: { readonly upstream: boolean } = { upstream: false }) {
    this.#tracksUpstream = options.upstream;
    this.#db = new DatabaseSync(path);
    openSchema(this.#db);
    if (!this.#tracksUpstream)
      this.#db.exec('UPDATE envelopes SET pending_up = 0 WHERE pending_up = 1');

    const info = this.#sql(STORE_INFO).get();
    if (info === undefined) throw new Error('The database has no store identity');
    this.id = toBase64url(info['id'] as Uint8Array);
    this.#prunedCursor = Number(info['pruned_cursor']);
  }

  /**
   * Stores an envelope unless the group already has this very envelope under this key; a
   * different envelope under a known key is stored too (ADR-0045). On a server with an upstream,
   * envelopes from clients are pending until `markUpstreamStored`.
   */
  append(
    group: Uint8Array,
    key: Uint8Array,
    env: Uint8Array,
    now: number,
    source: EnvelopeSource = 'client',
  ): AppendResult {
    const digest = envelopeDigest(env);
    const known = this.#sql(
      'SELECT cursor FROM envelopes WHERE group_id = ? AND event_key = ? AND digest = ?',
    ).get(group, key, digest);
    if (known !== undefined) return { cursor: Number(known['cursor']), isNew: false };
    const last = this.#sql(LAST_CURSOR).get(group);
    const cursor = (last === undefined ? this.#prunedCursor : Number(last['cursor'])) + 1;
    const pendingUp = source === 'client' && this.#tracksUpstream ? 1 : 0;
    transaction(this.#db, () => {
      this.#sql(
        'INSERT INTO envelopes (group_id, cursor, event_key, digest, envelope, received_at, pending_up) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(group, cursor, key, digest, env, now, pendingUp);
      this.#sql(
        'INSERT INTO group_cursors (group_id, cursor) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor',
      ).run(group, cursor);
    });
    return { cursor, isNew: true };
  }

  /**
   * The highest cursor a group has had, or 0 for a group the store does not know: never seen, or
   * forgotten once all its envelopes expired. Cursors are never reused: a forgotten group seen
   * again counts on from above any cursor it had.
   */
  lastCursor(group: Uint8Array): number {
    return Number(this.#sql(LAST_CURSOR).get(group)?.['cursor'] ?? 0);
  }

  /** Up to `limit` envelopes with a cursor greater than `cursor`, oldest first. */
  after(group: Uint8Array, cursor: number, limit: number): StoredEnvelope[] {
    return this.#sql(
      'SELECT cursor, event_key, envelope FROM envelopes WHERE group_id = ? AND cursor > ? ORDER BY cursor LIMIT ?',
    )
      .all(group, cursor, limit)
      .map(toStoredEnvelope);
  }

  /** Whether the database answers a query, for health reporting. */
  isAvailable(): boolean {
    try {
      return this.#sql(STORE_INFO).get() !== undefined;
    } catch {
      return false;
    }
  }

  /** The groups with envelopes the upstream lacks, the most recently received first. */
  groupsPendingUpstream(): Uint8Array[] {
    return this.#sql(
      'SELECT group_id FROM envelopes WHERE pending_up = 1 GROUP BY group_id ORDER BY MAX(received_at) DESC',
    )
      .all()
      .map((row) => new Uint8Array(row['group_id'] as Uint8Array));
  }

  /** The oldest envelope of a group that its upstream has not confirmed, if any. */
  nextPendingUpstream(group: Uint8Array): StoredEnvelope | null {
    const row = this.#sql(
      'SELECT cursor, event_key, envelope FROM envelopes WHERE group_id = ? AND pending_up = 1 ORDER BY cursor LIMIT 1',
    ).get(group);
    return row === undefined ? null : toStoredEnvelope(row);
  }

  markUpstreamStored(group: Uint8Array, cursor: number): void {
    this.#sql('UPDATE envelopes SET pending_up = 0 WHERE group_id = ? AND cursor = ?').run(
      group,
      cursor,
    );
  }

  /** How far this server has read the group from its upstream; 0 at first. */
  upstreamCursor(group: Uint8Array): number {
    return Number(this.#sql(UPSTREAM).get(group)?.['cursor'] ?? 0);
  }

  /** The upstream's store identity when this server last synced the group, or null. */
  upstreamStore(group: Uint8Array): string | null {
    const store = this.#sql(UPSTREAM).get(group)?.['store'];
    return typeof store === 'string' ? store : null;
  }

  setUpstreamCursor(group: Uint8Array, cursor: number): void {
    this.#sql(
      'INSERT INTO upstream_cursors (group_id, cursor) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor',
    ).run(group, cursor);
  }

  /** Records where the upstream's backlog ended, and the identity of the store it came from. */
  setUpstreamPosition(group: Uint8Array, cursor: number, store: string): void {
    this.#sql(SET_UPSTREAM_POSITION).run(group, cursor, store);
  }

  /**
   * Starts the group over with an upstream whose store has changed (ADR-0046): it is read again
   * from the beginning, and gets back every envelope this server holds for the group.
   */
  restartUpstream(group: Uint8Array, store: string): void {
    transaction(this.#db, () => {
      this.#sql(SET_UPSTREAM_POSITION).run(group, 0, store);
      this.#sql('UPDATE envelopes SET pending_up = 1 WHERE group_id = ?').run(group);
    });
  }

  /**
   * Deletes envelopes received before `time`, except those the upstream lacks, and forgets the
   * cursors of groups left without envelopes; returns how many envelopes went. The space they
   * took is given back to the file system.
   */
  deleteReceivedBefore(time: number): number {
    const deleted = transaction(this.#db, () => {
      // What the upstream still lacks is kept however old: a command post may be offline for long.
      const changes = Number(
        this.#sql('DELETE FROM envelopes WHERE received_at < ? AND pending_up = 0').run(time)
          .changes,
      );
      // Groups left without envelopes are forgotten; the cursor they reached is kept as the one
      // every forgotten group counts on from, so a cursor is never reused.
      this.#sql(
        `
        UPDATE store_info SET pruned_cursor = MAX(pruned_cursor, COALESCE(
          (SELECT MAX(cursor) FROM group_cursors AS g
            WHERE NOT EXISTS (SELECT 1 FROM envelopes AS e WHERE e.group_id = g.group_id)),
          0))
      `,
      ).run();
      this.#sql(
        'DELETE FROM group_cursors WHERE NOT EXISTS (SELECT 1 FROM envelopes AS e WHERE e.group_id = group_cursors.group_id)',
      ).run();
      this.#sql(
        'DELETE FROM upstream_cursors WHERE NOT EXISTS (SELECT 1 FROM envelopes AS e WHERE e.group_id = upstream_cursors.group_id)',
      ).run();
      return changes;
    });
    this.#prunedCursor = Number(
      this.#sql(STORE_INFO).get()?.['pruned_cursor'] ?? this.#prunedCursor,
    );
    this.#db.exec('PRAGMA incremental_vacuum');
    return deleted;
  }

  close(): void {
    this.#db.close();
  }

  #sql(text: string): StatementSync {
    let statement = this.#statements.get(text);
    if (statement === undefined) {
      statement = this.#db.prepare(text);
      this.#statements.set(text, statement);
    }
    return statement;
  }
}

function toStoredEnvelope(row: Record<string, unknown>): StoredEnvelope {
  return {
    cursor: Number(row['cursor']),
    key: new Uint8Array(row['event_key'] as Uint8Array),
    env: new Uint8Array(row['envelope'] as Uint8Array),
  };
}
