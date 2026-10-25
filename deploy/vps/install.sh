#!/usr/bin/env bash
# Installs a Teselia server on a fresh Debian or Ubuntu VPS, hardened and updating itself.
#
#   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Malla/main/deploy/vps/install.sh \
#     | sudo bash -s -- --domain teselia.example.eu
#
# Safe to run again: it converges to the same setup, which is also how configuration changes
# in this folder reach an existing server. See deploy/README.md for what it does and why.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/guaschpau-design/Malla"
REF="main"
DOMAIN=""
SKIP_DNS_CHECK=false
INSTALL_DIR="/opt/teselia"

usage() {
  echo "Usage: install.sh --domain DOMAIN [--ref GIT_REF] [--skip-dns-check]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --skip-dns-check) SKIP_DNS_CHECK=true; shift ;;
    *) usage ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -n "$DOMAIN" ]] || usage
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "\"$DOMAIN\" is not a domain name."
[[ $EUID -eq 0 ]] || fail "run as root (with sudo)."
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "debian" || "$ID" == "ubuntu" ]] || fail "only Debian and Ubuntu are supported."

step "Checking that $DOMAIN points to this server"
SERVER_IP="$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR == 1 {print $1}' || true)"
if [[ "$DOMAIN_IP" != "$SERVER_IP" && "$SKIP_DNS_CHECK" == false ]]; then
  fail "$DOMAIN resolves to '${DOMAIN_IP:-nothing}', but this server is $SERVER_IP.
Create an A record for $DOMAIN pointing to $SERVER_IP, wait a few minutes and run this again."
fi

step "Updating the system"
export DEBIAN_FRONTEND=noninteractive
APT_OPTIONS=(-yq -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get update -q
apt-get upgrade "${APT_OPTIONS[@]}"
apt-get install "${APT_OPTIONS[@]}" ca-certificates curl ufw fail2ban python3-systemd unattended-upgrades

step "Turning on automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
# Kernel updates only take effect after a reboot; do it at night. Containers come back alone.
cat > /etc/apt/apt.conf.d/52teselia-reboot <<'CONF'
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
cat > /etc/fail2ban/jail.d/teselia.local <<'CONF'
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
  cat > /etc/ssh/sshd_config.d/10-teselia.conf <<'CONF'
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
  apt-get update -q
  apt-get install "${APT_OPTIONS[@]}" docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

step "Installing Teselia in $INSTALL_DIR"
install -m 0755 -d "$INSTALL_DIR"
for file in compose.yaml Caddyfile; do
  curl -fsSL "$REPO_RAW/$REF/deploy/vps/$file" -o "$INSTALL_DIR/$file"
done
cat > "$INSTALL_DIR/.env" <<CONF
TESELIA_DOMAIN=$DOMAIN
CONF

cat > /etc/systemd/system/teselia-update.service <<'CONF'
[Unit]
Description=Update Teselia to the latest published version
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/teselia
ExecStart=/usr/bin/docker compose pull --quiet
ExecStart=/usr/bin/docker compose up --detach --remove-orphans
ExecStart=/usr/bin/docker image prune --force
CONF
cat > /etc/systemd/system/teselia-update.timer <<'CONF'
[Unit]
Description=Check for a new Teselia version every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
RandomizedDelaySec=2min

[Install]
WantedBy=timers.target
CONF
systemctl daemon-reload
systemctl enable --now teselia-update.timer >/dev/null

step "Starting Teselia"
cd "$INSTALL_DIR"
if ! docker compose pull --quiet; then
  fail "could not download the Teselia image. If the package on GitHub is private, make it public:
github.com/guaschpau-design → Packages → teselia-server → Package settings → Change visibility."
fi
docker compose up --detach --remove-orphans

step "Waiting for https://$DOMAIN"
for _ in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    printf '\n\033[32mTeselia is running at https://%s\033[0m\n' "$DOMAIN"
    echo "Use https://$DOMAIN as the server when creating a group."
    exit 0
  fi
  sleep 5
done
fail "the server did not answer on https://$DOMAIN within 5 minutes.
See what happened with: cd $INSTALL_DIR && docker compose logs"
