// Encrypted envelopes per group (docs/protocol.md §8), stored in SQLite through node:sqlite.
// The server never sees anything but group IDs, event keys and ciphertext.

import { DatabaseSync, type StatementSync } from 'node:sqlite';

export interface StoredEnvelope {
  readonly cursor: number;
  readonly env: Uint8Array;
}

export interface AppendResult {
  readonly cursor: number;
  /** False if an envelope with this key was already stored for the group. */
  readonly isNew: boolean;
}

export class EnvelopeStore {
  readonly #db: DatabaseSync;
  readonly #findKey: StatementSync;
  readonly #lastCursor: StatementSync;
  readonly #insert: StatementSync;
  readonly #after: StatementSync;
  readonly #deleteBefore: StatementSync;

  /** `path` is a file, or `:memory:` for tests. */
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS envelopes (
        group_id    BLOB    NOT NULL,
        cursor      INTEGER NOT NULL,
        event_key   BLOB    NOT NULL,
        envelope    BLOB    NOT NULL,
        received_at INTEGER NOT NULL,
        PRIMARY KEY (group_id, cursor),
        UNIQUE (group_id, event_key)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS envelopes_received_at ON envelopes (received_at);
    `);
    this.#findKey = this.#db.prepare(
      'SELECT cursor FROM envelopes WHERE group_id = ? AND event_key = ?',
    );
    this.#lastCursor = this.#db.prepare(
      'SELECT COALESCE(MAX(cursor), 0) AS cursor FROM envelopes WHERE group_id = ?',
    );
    this.#insert = this.#db.prepare(
      'INSERT INTO envelopes (group_id, cursor, event_key, envelope, received_at) VALUES (?, ?, ?, ?, ?)',
    );
    this.#after = this.#db.prepare(
      'SELECT cursor, envelope FROM envelopes WHERE group_id = ? AND cursor > ? ORDER BY cursor LIMIT ?',
    );
    this.#deleteBefore = this.#db.prepare('DELETE FROM envelopes WHERE received_at < ?');
  }

  /** Stores an envelope unless the group already has one with this key. */
  append(group: Uint8Array, key: Uint8Array, env: Uint8Array, now: number): AppendResult {
    const known = this.#findKey.get(group, key);
    if (known !== undefined) return { cursor: Number(known['cursor']), isNew: false };
    const cursor = this.lastCursor(group) + 1;
    this.#insert.run(group, cursor, key, env, now);
    return { cursor, isNew: true };
  }

  /** The highest cursor of a group, or 0 if it has no envelopes. */
  lastCursor(group: Uint8Array): number {
    return Number(this.#lastCursor.get(group)?.['cursor'] ?? 0);
  }

  /** Up to `limit` envelopes with a cursor greater than `cursor`, oldest first. */
  after(group: Uint8Array, cursor: number, limit: number): StoredEnvelope[] {
    return this.#after.all(group, cursor, limit).map((row) => ({
      cursor: Number(row['cursor']),
      env: new Uint8Array(row['envelope'] as Uint8Array),
    }));
  }

  /** Deletes envelopes received before `time`; returns how many. */
  deleteReceivedBefore(time: number): number {
    return Number(this.#deleteBefore.run(time).changes);
  }

  close(): void {
    this.#db.close();
  }
}
