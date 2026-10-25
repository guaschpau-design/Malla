// Encrypted envelopes per group (docs/protocol.md §8), stored in SQLite through node:sqlite.
// The server never sees anything but group IDs, event keys and ciphertext. A command post also
// remembers what its upstream still lacks and how far it has read from it (§8.2).

import { DatabaseSync, type StatementSync } from 'node:sqlite';

export interface StoredEnvelope {
  readonly cursor: number;
  readonly key: Uint8Array;
  readonly env: Uint8Array;
}

/** Who handed the envelope to this server: one of its clients, or its upstream (§8.2). */
export type EnvelopeSource = 'client' | 'upstream';

export interface AppendResult {
  readonly cursor: number;
  /** False if an envelope with this key was already stored for the group. */
  readonly isNew: boolean;
}

export class EnvelopeStore {
  readonly #db: DatabaseSync;
  readonly #findKey: StatementSync;
  readonly #lastCursor: StatementSync;
  readonly #setLastCursor: StatementSync;
  readonly #insert: StatementSync;
  readonly #after: StatementSync;
  readonly #deleteBefore: StatementSync;
  readonly #groups: StatementSync;
  readonly #pendingUp: StatementSync;
  readonly #markUp: StatementSync;
  readonly #upstreamCursor: StatementSync;
  readonly #setUpstreamCursor: StatementSync;

  readonly #tracksUpstream: boolean;

  /**
   * `path` is a file, or `:memory:` for tests. A server with an upstream (a command post) keeps
   * what its clients push pending until the upstream confirms it; one without keeps nothing
   * pending, so turning a server into a command post later uploads only what arrives from then on.
   */
  constructor(path: string, options: { readonly upstream: boolean } = { upstream: false }) {
    this.#tracksUpstream = options.upstream;
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS envelopes (
        group_id    BLOB    NOT NULL,
        cursor      INTEGER NOT NULL,
        event_key   BLOB    NOT NULL,
        envelope    BLOB    NOT NULL,
        received_at INTEGER NOT NULL,
        -- 1 while the upstream of a command post lacks it (protocol §8.2).
        pending_up  INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (group_id, cursor),
        UNIQUE (group_id, event_key)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS envelopes_received_at ON envelopes (received_at);
      CREATE TABLE IF NOT EXISTS group_cursors (
        group_id BLOB    NOT NULL PRIMARY KEY,
        cursor   INTEGER NOT NULL
      ) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS upstream_cursors (
        group_id BLOB    NOT NULL PRIMARY KEY,
        cursor   INTEGER NOT NULL
      ) WITHOUT ROWID;
    `);
    this.#migrate();
    if (!this.#tracksUpstream)
      this.#db.exec('UPDATE envelopes SET pending_up = 0 WHERE pending_up = 1');
    this.#findKey = this.#db.prepare(
      'SELECT cursor FROM envelopes WHERE group_id = ? AND event_key = ?',
    );
    this.#lastCursor = this.#db.prepare('SELECT cursor FROM group_cursors WHERE group_id = ?');
    this.#setLastCursor = this.#db.prepare(
      'INSERT INTO group_cursors (group_id, cursor) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor',
    );
    this.#insert = this.#db.prepare(
      'INSERT INTO envelopes (group_id, cursor, event_key, envelope, received_at, pending_up) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.#after = this.#db.prepare(
      'SELECT cursor, event_key, envelope FROM envelopes WHERE group_id = ? AND cursor > ? ORDER BY cursor LIMIT ?',
    );
    // What the upstream still lacks is kept however old: a command post may be offline for long.
    this.#deleteBefore = this.#db.prepare(
      'DELETE FROM envelopes WHERE received_at < ? AND pending_up = 0',
    );
    this.#groups = this.#db.prepare('SELECT group_id FROM group_cursors');
    this.#pendingUp = this.#db.prepare(
      'SELECT cursor, event_key, envelope FROM envelopes WHERE group_id = ? AND pending_up = 1 ORDER BY cursor LIMIT 1',
    );
    this.#markUp = this.#db.prepare(
      'UPDATE envelopes SET pending_up = 0 WHERE group_id = ? AND event_key = ?',
    );
    this.#upstreamCursor = this.#db.prepare(
      'SELECT cursor FROM upstream_cursors WHERE group_id = ?',
    );
    this.#setUpstreamCursor = this.#db.prepare(
      'INSERT INTO upstream_cursors (group_id, cursor) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET cursor = excluded.cursor',
    );
  }

  /**
   * Stores an envelope unless the group already has one with this key. On a server with an
   * upstream, envelopes from clients are pending until `markUpstreamStored`.
   */
  append(
    group: Uint8Array,
    key: Uint8Array,
    env: Uint8Array,
    now: number,
    source: EnvelopeSource = 'client',
  ): AppendResult {
    const known = this.#findKey.get(group, key);
    if (known !== undefined) return { cursor: Number(known['cursor']), isNew: false };
    const cursor = this.lastCursor(group) + 1;
    this.#db.exec('BEGIN');
    try {
      this.#insert.run(
        group,
        cursor,
        key,
        env,
        now,
        source === 'client' && this.#tracksUpstream ? 1 : 0,
      );
      this.#setLastCursor.run(group, cursor);
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
    return { cursor, isNew: true };
  }

  /**
   * The highest cursor a group has had, or 0 for a group never seen. Cursors are never reused,
   * even after the retention period has deleted every envelope of a group.
   */
  lastCursor(group: Uint8Array): number {
    return Number(this.#lastCursor.get(group)?.['cursor'] ?? 0);
  }

  /** Up to `limit` envelopes with a cursor greater than `cursor`, oldest first. */
  after(group: Uint8Array, cursor: number, limit: number): StoredEnvelope[] {
    return this.#after.all(group, cursor, limit).map(toStoredEnvelope);
  }

  /** Every group this server has stored envelopes for. */
  groups(): Uint8Array[] {
    return this.#groups.all().map((row) => new Uint8Array(row['group_id'] as Uint8Array));
  }

  /** The oldest envelope of a group that its upstream has not confirmed, if any. */
  nextPendingUpstream(group: Uint8Array): StoredEnvelope | null {
    const row = this.#pendingUp.get(group);
    return row === undefined ? null : toStoredEnvelope(row);
  }

  markUpstreamStored(group: Uint8Array, key: Uint8Array): void {
    this.#markUp.run(group, key);
  }

  /** How far this server has read the group from its upstream; 0 at first. */
  upstreamCursor(group: Uint8Array): number {
    return Number(this.#upstreamCursor.get(group)?.['cursor'] ?? 0);
  }

  setUpstreamCursor(group: Uint8Array, cursor: number): void {
    this.#setUpstreamCursor.run(group, cursor);
  }

  /** Deletes envelopes received before `time`, except those the upstream lacks; returns how many. */
  deleteReceivedBefore(time: number): number {
    return Number(this.#deleteBefore.run(time).changes);
  }

  close(): void {
    this.#db.close();
  }

  /** Brings databases created by earlier versions up to date. */
  #migrate(): void {
    const columns = this.#db.prepare('PRAGMA table_info(envelopes)').all();
    if (!columns.some((column) => column['name'] === 'pending_up')) {
      this.#db.exec(`
        ALTER TABLE envelopes ADD COLUMN pending_up INTEGER NOT NULL DEFAULT 0;
        INSERT OR IGNORE INTO group_cursors (group_id, cursor)
          SELECT group_id, MAX(cursor) FROM envelopes GROUP BY group_id;
      `);
    }
  }
}

function toStoredEnvelope(row: Record<string, unknown>): StoredEnvelope {
  return {
    cursor: Number(row['cursor']),
    key: new Uint8Array(row['event_key'] as Uint8Array),
    env: new Uint8Array(row['envelope'] as Uint8Array),
  };
}
