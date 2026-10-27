#!/usr/bin/env bash
# Brings a command post up to date whenever it has internet: run by tesel-post-refresh.timer
# every 6 hours and by install.sh. Without internet it does nothing. With it:
#
#   1. it downloads the posts' certificate from the upstream server with this post's token
#      (docs/decisions/0050-post-certificates-from-the-server.md) and gives it to Caddy when it
#      changed;
#   2. it updates the server image as the VPS does (update.sh: signed, checked, rolled back);
#   3. it copies the upstream's base map and its licence notice when they changed, so phones on
#      the post's Wi-Fi see the whole area.
#
#   refresh.sh [DIRECTORY]

set -euo pipefail

DIR="${1:-/opt/tesel-post}"
cd "$DIR"

setting() { sed -n "s/^$1=//p" .env | tail -n 1; }
DOMAIN="$(setting TESEL_DOMAIN)"
UPSTREAM="$(setting TESEL_UPSTREAM)"
UPSTREAM="${UPSTREAM%/}"

fail() {
  echo "$*" >&2
  exit 1
}

# Downloads certificate.crt and certificate.key, checks that they are a valid pair for this
# post's name and installs them when they changed.
refresh_certificate() {
  local new="certs/.new" file
  rm -rf "$new"
  install -m 0700 -d "$new"
  for file in certificate.crt certificate.key; do
    # The token goes to curl on its standard input, never on a command line.
    printf 'user = "%s"\n' "$(cat token)" |
      curl -fsS --max-time 60 --config - -o "$new/$file" "$UPSTREAM/post-certificate/$file" ||
      fail "Could not download the certificate from $UPSTREAM. Is this post's token still valid?"
  done
  openssl x509 -in "$new/certificate.crt" -noout -checkend 0 >/dev/null ||
    fail "The certificate from $UPSTREAM has expired."
  openssl x509 -in "$new/certificate.crt" -noout -checkhost "$DOMAIN" | grep -q 'does match' ||
    fail "The certificate from $UPSTREAM is not for $DOMAIN."
  [[ "$(openssl x509 -in "$new/certificate.crt" -noout -pubkey)" == \
    "$(openssl pkey -in "$new/certificate.key" -pubout)" ]] ||
    fail "The certificate and key from $UPSTREAM do not match."

  if cmp -s "$new/certificate.crt" certs/certificate.crt &&
    cmp -s "$new/certificate.key" certs/certificate.key; then
    rm -rf "$new"
    return
  fi
  install -m 0600 "$new/certificate.key" certs/certificate.key
  install -m 0644 "$new/certificate.crt" certs/certificate.crt
  rm -rf "$new"
  echo "New certificate for $DOMAIN installed."
  # Caddy reads certificate files when it starts.
  if [[ -n "$(docker compose ps --quiet --status running caddy)" ]]; then
    docker compose restart caddy >/dev/null
  fi
}

# Copies maps/FILE from the upstream when it changed there.
copy_map_file() {
  local file="maps/$1" since=()
  [[ -f "$file" ]] && since=(--time-cond "$file")
  rm -f "$file.new"
  curl -fsS "${since[@]}" -o "$file.new" "$UPSTREAM/$file"
  if [[ -s "$file.new" ]]; then
    chmod 0644 "$file.new"
    mv "$file.new" "$file"
  else
    rm -f "$file.new"
  fi
}

if ! curl -fsS --max-time 20 -o /dev/null "$UPSTREAM/healthz"; then
  echo "$UPSTREAM cannot be reached: nothing to refresh now."
  exit 0
fi

refresh_certificate
"$DIR/update.sh" "$DIR"
install -m 0755 -d maps
copy_map_file basemap.pmtiles
copy_map_file README.txt
