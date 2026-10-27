#!/usr/bin/env bash
# Backs up the Tesel server, every night from tesel-backup.timer, into DIRECTORY/backups:
#
#   - tesel-TIME.db: a consistent copy of the server's SQLite database, made with VACUUM INTO by
#     a throwaway container of the server's own image while the server keeps running, and
#     checked with PRAGMA integrity_check;
#   - caddy-data-TIME.tar.gz: Caddy's certificates and ACME account.
#
# Copies older than TESEL_BACKUP_DAYS (default 14) are deleted. When DIRECTORY/backup.env exists
# it names a restic repository and its credentials, and the folder is also copied off the host
# (deploy/README.md, "Backups").
#
#   backup.sh [DIRECTORY]

set -euo pipefail

DIR="${1:-/opt/tesel}"
KEEP_DAYS="${TESEL_BACKUP_DAYS:-14}"
RESTIC_IMAGE="restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510"
# The user the server image runs as ("node"), which owns the database.
SERVER_UID=1000

cd "$DIR"
backups="$DIR/backups"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
install -m 0700 -d "$backups"

# The copy is written by the server's user into a folder of its own, then moved here by root.
staging="$backups/.staging"
rm -rf "$staging"
install -m 0700 -o "$SERVER_UID" -g "$SERVER_UID" -d "$staging"
trap 'rm -rf "$staging"' EXIT
docker compose run --rm --no-deps --no-TTY --quiet-pull --volume "$staging:/backup" \
  --entrypoint node tesel --input-type=module --eval "
    import { DatabaseSync } from 'node:sqlite';
    const source = new DatabaseSync(process.env.TESEL_DB, { readOnly: true });
    source.exec(\"VACUUM INTO '/backup/tesel.db'\");
    source.close();
    const copy = new DatabaseSync('/backup/tesel.db', { readOnly: true });
    const { integrity_check: integrity } = copy.prepare('PRAGMA integrity_check').get();
    if (integrity !== 'ok') throw new Error('backup failed its integrity check: ' + integrity);
  "
install -m 0600 -o root -g root "$staging/tesel.db" "$backups/tesel-$stamp.db"

docker compose run --rm --no-deps --no-TTY --quiet-pull --entrypoint tar caddy \
  -C /data -czf - . > "$backups/caddy-data-$stamp.tar.gz.partial"
chmod 0600 "$backups/caddy-data-$stamp.tar.gz.partial"
mv "$backups/caddy-data-$stamp.tar.gz.partial" "$backups/caddy-data-$stamp.tar.gz"

find "$backups" -maxdepth 1 -type f \( -name 'tesel-*.db' -o -name 'caddy-data-*.tar.gz' \) \
  -mtime "+$KEEP_DAYS" -delete
echo "Backed up to $backups: tesel-$stamp.db, caddy-data-$stamp.tar.gz"

[[ -f "$DIR/backup.env" ]] || exit 0
restic() {
  docker run --rm --env-file "$DIR/backup.env" --hostname tesel \
    --volume "$backups:/backups:ro" "$RESTIC_IMAGE" "$@"
}
restic backup --quiet --exclude /backups/.staging /backups
restic forget --quiet --keep-daily "$KEEP_DAYS" --prune
echo "Copied off the host to the restic repository of backup.env"
