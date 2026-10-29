#!/usr/bin/env bash
# The Tesel server's SQLite database, handled by throwaway containers of the server's own image,
# which has node:sqlite and runs as the user that owns the database. backup.sh and update.sh use
# it, and so does whoever restores a backup (deploy/README.md, "Runbook").
#
#   database.sh DIRECTORY copy FILE      writes a consistent copy of the database into FILE, made
#                                        with VACUUM INTO while the server runs and checked with
#                                        PRAGMA integrity_check; refused when the disk would keep
#                                        less than TESEL_MIN_FREE_DISK_MB (500) free after it
#   database.sh DIRECTORY restore FILE   stops the server and replaces its database with the copy
#                                        in FILE, under a new store identity: clients then know
#                                        that what they remember of the server may be gone, and
#                                        push their own events again (ADR-0046)
#   database.sh DIRECTORY schema         prints the database's schema version

set -euo pipefail

usage() {
  echo "usage: database.sh DIRECTORY copy FILE | restore FILE | schema" >&2
  exit 2
}

DIR="${1:-}"
ACTION="${2:-}"
FILE="${3:-}"
[[ -n "$DIR" ]] || usage
# The user the server image runs as ("node"), which owns the database.
SERVER_UID=1000

# Node scripts run in the image, with TESEL_DB naming the database and /work a folder of the host.
COPY_SCRIPT="$(cat <<'JS'
import { statfsSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const database = process.env.TESEL_DB;
// The copy takes at most the database's size, and the disk must keep the margin the server keeps
// for itself (apps/server/README.md, TESEL_MIN_FREE_DISK_MB), whose default this repeats.
const megabyte = 1024 * 1024;
const margin = Number(process.env.TESEL_MIN_FREE_DISK_MB || 500) * megabyte;
const size = ['', '-wal']
  .map((suffix) => statSync(database + suffix, { throwIfNoEntry: false })?.size ?? 0)
  .reduce((sum, bytes) => sum + bytes);
const { bavail, bsize } = statfsSync('/work');
if (bavail * bsize < size + margin) {
  const needed = Math.ceil((size + margin) / megabyte);
  const free = Math.floor((bavail * bsize) / megabyte);
  console.error(`No copy of the database: it needs ${needed} MB free, and there are ${free} MB.`);
  process.exit(1);
}
const source = new DatabaseSync(database, { readOnly: true });
source.exec("VACUUM INTO '/work/tesel.db'");
source.close();
const copy = new DatabaseSync('/work/tesel.db', { readOnly: true });
const { integrity_check: integrity } = copy.prepare('PRAGMA integrity_check').get();
if (integrity !== 'ok') throw new Error('the copy failed its integrity check: ' + integrity);
JS
)"

RESTORE_SCRIPT="$(cat <<'JS'
import { copyFileSync, renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const database = process.env.TESEL_DB;
const incoming = `${database}.restoring`;
copyFileSync('/work/tesel.db', incoming);
// The copy carries the identity of the store it was taken from, which clients may know: 16 random
// bytes, as the server makes them (protocol §8).
const restored = new DatabaseSync(incoming);
restored.exec('UPDATE store_info SET id = randomblob(16)');
restored.close();
// What is left of the database it replaces would be read by SQLite as part of the new one.
rmSync(`${database}-wal`, { force: true });
rmSync(`${database}-shm`, { force: true });
renameSync(incoming, database);
JS
)"

SCHEMA_SCRIPT="$(cat <<'JS'
import { DatabaseSync } from 'node:sqlite';

const database = new DatabaseSync(process.env.TESEL_DB, { readOnly: true });
console.log(database.prepare('PRAGMA user_version').get().user_version);
JS
)"

# Runs SCRIPT in a container of the server's image, with the host's folder FOLDER, if given, at
# /work. Node's warning that node:sqlite is experimental is left out of the output.
run_in_image() {
  local script="$1" volume=()
  [[ -z "${2:-}" ]] || volume=(--volume "$2:/work")
  docker compose run --rm --no-deps --no-TTY --quiet-pull "${volume[@]}" \
    --entrypoint node tesel --no-warnings --input-type=module --eval "$script"
}

# A folder next to FILE that the server's user may write and nobody else read, removed on exit.
staging=""
trap '[[ -z "$staging" ]] || rm -rf "$staging"' EXIT
make_staging() {
  install -m 0700 -d "$(dirname "$1")"
  staging="$(mktemp -d "$(dirname "$1")/.staging.XXXXXX")"
  chown "$SERVER_UID:$SERVER_UID" "$staging"
}

cd "$DIR"
case "$ACTION" in
  copy)
    [[ -n "$FILE" ]] || usage
    make_staging "$FILE"
    run_in_image "$COPY_SCRIPT" "$staging"
    install -m 0600 -o root -g root "$staging/tesel.db" "$FILE"
    ;;
  restore)
    [[ -f "$FILE" ]] || { echo "There is no copy of the database at $FILE." >&2; exit 1; }
    make_staging "$FILE"
    install -m 0600 -o "$SERVER_UID" -g "$SERVER_UID" "$FILE" "$staging/tesel.db"
    docker compose stop tesel
    run_in_image "$RESTORE_SCRIPT" "$staging"
    echo "Restored the database from $FILE, under a new store identity."
    ;;
  schema) run_in_image "$SCHEMA_SCRIPT" ;;
  *) usage ;;
esac
