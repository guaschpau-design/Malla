#!/usr/bin/env bash
# The certificate of this server's command posts (docs/decisions/0050-post-certificates-from-the-server.md).
# All posts of the server share one name, TESEL_COMMAND_POST in .env. The server obtains its
# certificate with lego by DNS challenge, using DNS credentials only the server holds (dns.env),
# and hands certificate and key to the posts that present a valid token, at
# https://DOMAIN/post-certificate/. A lost post is shut out by revoking its token.
#
#   post-certificate.sh renew          obtain or renew the certificate (tesel-post-certificate.timer)
#   post-certificate.sh grant NAME     create a token for the post NAME and print it, once
#   post-certificate.sh revoke NAME    delete the token of the post NAME
#   post-certificate.sh list           list the posts that hold a token
#   post-certificate.sh configure      write Caddy's part from the tokens (run by install.sh)

set -euo pipefail

DIR="/opt/tesel"
LEGO_IMAGE="goacme/lego:v5.5.2@sha256:1944e8c36055beec47c7de6f15202b41128be75eea0ffa257f0c14d93c5155fd"
# lego's account and certificates.
LEGO_STATE="$DIR/lego"
# What Caddy serves to posts: certificate.crt and certificate.key.
PUBLISHED="$DIR/post-certificate"
# One line per post: its name and the bcrypt hash of its token. Tokens themselves are not kept.
TOKENS="$DIR/post-tokens"
CADDY_PART="$DIR/post-certificate.caddy"
# Renewed when fewer days than this are left, so the certificate a post downloads lasts at least
# two months offline, as the guide promises. Suits 90-day certificates; must come down if the
# certificate authority shortens them (ADR-0050).
RENEW_DAYS=60

fail() {
  echo "$*" >&2
  exit 1
}
setting() { sed -n "s/^$1=//p" "$DIR/.env" | tail -n 1; }

renew() {
  local post_url name
  post_url="$(setting TESEL_COMMAND_POST)"
  [[ -n "$post_url" ]] || fail "No command post is announced (TESEL_COMMAND_POST in .env)."
  name="${post_url#https://}"
  name="${name%/}"
  [[ -f "$DIR/dns.env" ]] || fail "No DNS credentials in $DIR/dns.env. Run install.sh with --dns."

  install -m 0700 -d "$LEGO_STATE" "$PUBLISHED"
  docker run --rm --env-file "$DIR/dns.env" --cap-drop ALL --security-opt no-new-privileges \
    --volume "$LEGO_STATE:/lego" "$LEGO_IMAGE" \
    run --path /lego --accept-tos --email "$(setting TESEL_POST_EMAIL)" \
    --dns "$(setting TESEL_POST_DNS)" --domains "$name" --renew-days "$RENEW_DAYS"

  # Each file is replaced at once, so a post never downloads half of one.
  local extension
  for extension in crt key; do
    install -m 0600 "$LEGO_STATE/certificates/$name.$extension" "$PUBLISHED/.certificate.$extension"
    mv "$PUBLISHED/.certificate.$extension" "$PUBLISHED/certificate.$extension"
  done
  echo "The certificate for $name is ready for the posts."
}

# Caddy's part: an authenticated route to the certificate, or nothing while no post has a token.
configure() {
  touch "$TOKENS"
  chmod 0600 "$TOKENS"
  {
    echo "# Written by post-certificate.sh from post-tokens: posts download their certificate here"
    echo "# with their token (ADR-0050). Change who can with post-certificate.sh grant and revoke."
    if [[ -s "$TOKENS" ]]; then
      printf 'handle_path /post-certificate/* {\n\tbasic_auth {\n'
      local name hash
      while read -r name hash; do
        printf '\t\t%s %s\n' "$name" "$hash"
      done < "$TOKENS"
      printf '\t}\n\theader Cache-Control "no-store"\n\troot * /srv/post-certificate\n\tfile_server\n}\n'
    fi
  } > "$CADDY_PART"
}

reload_caddy() {
  cd "$DIR"
  [[ -n "$(docker compose ps --quiet --status running caddy)" ]] || return 0
  docker compose exec --no-TTY caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
}

check_name() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]] ||
    fail "A post's name is up to 32 lowercase letters, digits and hyphens, e.g. post-1."
}

grant() {
  local name="$1" token hash
  check_name "$name"
  touch "$TOKENS"
  ! grep -q "^$name " "$TOKENS" || fail "The post $name already has a token; revoke it first."
  token="$(openssl rand -hex 24)"
  hash="$(cd "$DIR" && docker compose run --rm --no-deps --no-TTY --quiet-pull --entrypoint caddy \
    caddy hash-password --plaintext "$token")"
  echo "$name $hash" >> "$TOKENS"
  configure
  reload_caddy
  echo "Token of the post $name (shown only now; install the post with it):"
  echo
  echo "  $name:$token"
}

revoke() {
  local name="$1"
  check_name "$name"
  grep -q "^$name " "$TOKENS" 2>/dev/null || fail "The post $name has no token."
  sed -i "/^$name /d" "$TOKENS"
  configure
  reload_caddy
  echo "The post $name can no longer download the certificate."
}

case "${1:-}" in
  renew) renew ;;
  configure) configure ;;
  grant) grant "${2:?usage: post-certificate.sh grant NAME}" ;;
  revoke) revoke "${2:?usage: post-certificate.sh revoke NAME}" ;;
  list) cut -d ' ' -f 1 "$TOKENS" ;;
  *) fail "usage: post-certificate.sh renew|configure|grant NAME|revoke NAME|list" ;;
esac
