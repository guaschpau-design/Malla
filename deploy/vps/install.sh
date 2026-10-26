#!/usr/bin/env bash
# Installs a Tesel server on a fresh Debian or Ubuntu VPS, hardened and updating itself.
#
#   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/vps/install.sh \
#     | sudo bash -s -- --domain tesel.example.eu [--redirect-from old.example.eu]
#
# Safe to run again: it converges to the same setup, which is also how configuration changes
# in this folder reach an existing server. See deploy/README.md for what it does and why.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/guaschpau-design/Tesel"
REF="main"
DOMAIN=""
REDIRECT_FROM=""
COMMAND_POST=""
SKIP_DNS_CHECK=false
INSTALL_DIR="/opt/tesel"
# Where servers installed before the project was renamed live (ADR-0019).
LEGACY_DIR="/opt/teselia"

usage() {
  echo "Usage: install.sh --domain DOMAIN [--redirect-from DOMAIN[,DOMAIN...]] [--command-post URL]" >&2
  echo "                  [--ref GIT_REF] [--skip-dns-check]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --redirect-from) REDIRECT_FROM="${2:-}"; shift 2 ;;
    --command-post) COMMAND_POST="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --skip-dns-check) SKIP_DNS_CHECK=true; shift ;;
    *) usage ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

is_domain() { [[ "$1" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; }

[[ -n "$DOMAIN" ]] || usage
is_domain "$DOMAIN" || fail "\"$DOMAIN\" is not a domain name."
IFS=',' read -r -a REDIRECT_DOMAINS <<< "$REDIRECT_FROM"
for old in "${REDIRECT_DOMAINS[@]}"; do
  is_domain "$old" || fail "--redirect-from: \"$old\" is not a domain name."
done
[[ -z "$COMMAND_POST" || "$COMMAND_POST" =~ ^https://[A-Za-z0-9.-]+/?$ ]] ||
  fail "--command-post must be https://host"
[[ $EUID -eq 0 ]] || fail "run as root (with sudo)."
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "debian" || "$ID" == "ubuntu" ]] || fail "only Debian and Ubuntu are supported."

# Caddy can only obtain certificates for names that reach this server.
step "Checking that ${DOMAIN}${REDIRECT_FROM:+ and $REDIRECT_FROM} point to this server"
SERVER_IP="$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
for name in "$DOMAIN" "${REDIRECT_DOMAINS[@]}"; do
  NAME_IP="$(getent ahostsv4 "$name" | awk 'NR == 1 {print $1}' || true)"
  if [[ "$NAME_IP" != "$SERVER_IP" && "$SKIP_DNS_CHECK" == false ]]; then
    fail "$name resolves to '${NAME_IP:-nothing}', but this server is $SERVER_IP.
Create an A record for $name pointing to $SERVER_IP, wait a few minutes and run this again."
  fi
done

step "Updating the system"
export DEBIAN_FRONTEND=noninteractive
# Automatic updates may hold the package lock when this runs; wait up to 10 minutes for them.
APT_LOCK=(-o DPkg::Lock::Timeout=600)
APT_OPTIONS=(-yq "${APT_LOCK[@]}" -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get update -q "${APT_LOCK[@]}"
apt-get upgrade "${APT_OPTIONS[@]}"
apt-get install "${APT_OPTIONS[@]}" ca-certificates curl ufw fail2ban python3-systemd unattended-upgrades

step "Turning on automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
# Kernel updates only take effect after a reboot; do it at night. Containers come back alone.
cat > /etc/apt/apt.conf.d/52tesel-reboot <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
CONF

step "Configuring the firewall: only SSH and the web are reachable"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

step "Blocking repeated failed SSH logins"
cat > /etc/fail2ban/jail.d/tesel.local <<'CONF'
[DEFAULT]
backend = systemd
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
CONF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

step "Hardening SSH"
has_ssh_key() {
  [[ -s /root/.ssh/authorized_keys ]] && return 0
  find /home -mindepth 3 -maxdepth 3 -path '*/.ssh/authorized_keys' -size +0 2>/dev/null | grep -q .
}
if has_ssh_key; then
  # sshd keeps the first value it reads, and drop-ins are read in name order: "10-" goes before
  # cloud images' "50-cloud-init.conf", which turns passwords back on.
  cat > /etc/ssh/sshd_config.d/10-tesel.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "SSH keys found: password logins are now off."
else
  echo "No SSH key installed, so password logins stay on (turning them off would lock you out)."
  echo "Recommended: add an SSH key in the provider's panel and run this script again."
fi

step "Installing Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/$ID $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q "${APT_LOCK[@]}"
  apt-get install "${APT_OPTIONS[@]}" docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

# A server installed while the project was called Teselia moves here, only now that the system and
# Docker are ready, so a failure in those steps leaves it running. Its base map and settings are
# kept. The rest goes, its stored envelopes too: they were sealed with keys derived under the old
# name and no app can open them (ADR-0019).
if [[ -d "$LEGACY_DIR" ]]; then
  step "Moving the server installed as Teselia to $INSTALL_DIR"
  systemctl disable --now teselia-update.timer teselia-maps.timer >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/teselia-{update,maps}.{service,timer}
  systemctl daemon-reload
  (cd "$LEGACY_DIR" && docker compose down --volumes --rmi all) || true
  install -m 0755 -d "$INSTALL_DIR"
  if [[ -d "$LEGACY_DIR/maps" && ! -e "$INSTALL_DIR/maps" ]]; then
    mv "$LEGACY_DIR/maps" "$INSTALL_DIR/maps"
  fi
  if [[ -f "$LEGACY_DIR/.env" && ! -e "$INSTALL_DIR/.env" ]]; then
    sed 's/^TESELIA_/TESEL_/' "$LEGACY_DIR/.env" > "$INSTALL_DIR/.env"
  fi
  rm -rf "$LEGACY_DIR"
  rm -f /etc/apt/apt.conf.d/52teselia-reboot /etc/fail2ban/jail.d/teselia.local \
    /etc/ssh/sshd_config.d/10-teselia.conf
fi

step "Installing Tesel in $INSTALL_DIR"
install -m 0755 -d "$INSTALL_DIR"
for file in compose.yaml Caddyfile maps.sh; do
  curl -fsSL "$REPO_RAW/$REF/deploy/vps/$file" -o "$INSTALL_DIR/$file"
done
chmod 0755 "$INSTALL_DIR/maps.sh"
# Settings live in .env; each run updates its own and keeps any other an operator added there
# (TESEL_RETENTION_DAYS, TESEL_MAP_BBOX...). A command post or old domains set before stay
# unless replaced.
set_setting() {
  touch "$INSTALL_DIR/.env"
  sed -i "/^$1=/d" "$INSTALL_DIR/.env"
  echo "$1=$2" >> "$INSTALL_DIR/.env"
}
set_setting TESEL_DOMAIN "$DOMAIN"
if [[ -n "$REDIRECT_FROM" ]] || ! grep -q '^TESEL_REDIRECT_FROM=' "$INSTALL_DIR/.env"; then
  set_setting TESEL_REDIRECT_FROM "$REDIRECT_FROM"
fi
# Caddy needs site names in its configuration itself, so the redirect site is written from the
# setting into a file the Caddyfile imports (empty when there are no old names).
REDIRECT_FROM="$(sed -n 's/^TESEL_REDIRECT_FROM=//p' "$INSTALL_DIR/.env")"
{
  echo "# Written by install.sh from TESEL_REDIRECT_FROM in .env: old names answer with a"
  echo "# permanent redirect to the same address on $DOMAIN. Run install.sh again to change it."
  if [[ -n "$REDIRECT_FROM" ]]; then
    printf '%s {\n\tredir https://%s{uri} permanent\n}\n' "${REDIRECT_FROM//,/, }" "$DOMAIN"
  fi
} > "$INSTALL_DIR/redirects.caddy"
if [[ -n "$COMMAND_POST" ]] || ! grep -q '^TESEL_COMMAND_POST=' "$INSTALL_DIR/.env" 2>/dev/null; then
  set_setting TESEL_COMMAND_POST "$COMMAND_POST"
fi

cat > /etc/systemd/system/tesel-update.service <<'CONF'
[Unit]
Description=Update Tesel to the latest published version
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/tesel
ExecStart=/usr/bin/docker compose pull --quiet
ExecStart=/usr/bin/docker compose up --detach --remove-orphans
ExecStart=/usr/bin/docker image prune --force
CONF
cat > /etc/systemd/system/tesel-update.timer <<'CONF'
[Unit]
Description=Check for a new Tesel version every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
RandomizedDelaySec=2min

[Install]
WantedBy=timers.target
CONF
cat > /etc/systemd/system/tesel-maps.service <<'CONF'
[Unit]
Description=Rebuild the Tesel base map from the latest OpenStreetMap data
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=-/opt/tesel/.env
ExecStart=/opt/tesel/maps.sh /opt/tesel/maps
CONF
cat > /etc/systemd/system/tesel-maps.timer <<'CONF'
[Unit]
Description=Rebuild the Tesel base map every month

[Timer]
OnCalendar=monthly
RandomizedDelaySec=1d
Persistent=true

[Install]
WantedBy=timers.target
CONF
systemctl daemon-reload

if [[ ! -f "$INSTALL_DIR/maps/basemap.pmtiles" ]]; then
  step "Building the base map (only the first time; it can take half an hour)"
  # shellcheck source=/dev/null
  (set -a && . "$INSTALL_DIR/.env" && "$INSTALL_DIR/maps.sh" "$INSTALL_DIR/maps") ||
    echo "The base map could not be built now; tesel-maps.timer will try again."
fi
# Enabled only now, so its first run cannot overlap the build above.
systemctl enable --now tesel-maps.timer >/dev/null

step "Starting Tesel"
cd "$INSTALL_DIR"
if ! docker compose pull --quiet; then
  fail "could not download the Tesel image. If the package on GitHub is private, make it public:
github.com/guaschpau-design → Packages → tesel-server → Package settings → Change visibility."
fi
docker compose up --detach --remove-orphans
# Enabled only now: a timer whose boot delay has passed fires at once, and its own "compose up"
# would race the one above for the same container names.
systemctl enable --now tesel-update.timer >/dev/null

step "Waiting for https://$DOMAIN"
for _ in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    printf '\n\033[32mTesel is running at https://%s\033[0m\n' "$DOMAIN"
    echo "The app is at https://$DOMAIN/app/ and creates its groups on this server."
    exit 0
  fi
  sleep 5
done
fail "the server did not answer on https://$DOMAIN within 5 minutes.
See what happened with: cd $INSTALL_DIR && docker compose logs"
