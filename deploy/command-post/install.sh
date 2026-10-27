#!/usr/bin/env bash
# Turns a Debian, Ubuntu or Raspberry Pi OS computer with Wi-Fi into a Tesel command post:
# its own Wi-Fi network, the app and a relay that replicates the group's server whenever the
# computer has internet (docs/decisions/0018-command-post.md).
#
#   sudo env TESEL_POST_TOKEN=post-1:0123abcd... bash install.sh \
#     --domain puesto.tesel.eu --upstream https://tesel.eu
#
# The token comes from the upstream server (post-certificate.sh grant post-1): with it the post
# downloads its certificate from there (docs/decisions/0050-post-certificates-from-the-server.md).
# It is needed on the first run only. To install the files of a release instead of main, pass
# its tag with --ref (deploy/README.md).
#
# Run it with internet, by cable or USB tethering if possible: it downloads everything the post
# needs and turns the Wi-Fi into the post's network at the very end. Safe to run again.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/guaschpau-design/Tesel"
REF="main"
INSTALL_DIR="/opt/tesel-post"
POST_ADDRESS="10.42.0.1"
DOMAIN=""
UPSTREAM=""
WIFI_NAME="Tesel"
WIFI_PASSWORD=""
WIFI_INTERFACE=""

usage() {
  cat >&2 <<'TEXT'
Usage: sudo env TESEL_POST_TOKEN=NAME:TOKEN bash install.sh --domain NAME --upstream URL
                  [--wifi-name NAME] [--wifi-password PASSWORD] [--wifi-interface IFACE]
                  [--ref GIT_REF]

  --domain     Name of the post, the same for every post of a server, e.g. puesto.tesel.eu
  --upstream   The group's server, e.g. https://tesel.eu
  --ref        Branch or tag whose deployment files are installed (default: main)

TESEL_POST_TOKEN is this post's token from the upstream server (post-certificate.sh grant).
TEXT
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --upstream) UPSTREAM="${2:-}"; shift 2 ;;
    --wifi-name) WIFI_NAME="${2:-}"; shift 2 ;;
    --wifi-password) WIFI_PASSWORD="${2:-}"; shift 2 ;;
    --wifi-interface) WIFI_INTERFACE="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -n "$DOMAIN" && -n "$UPSTREAM" ]] || usage
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "\"$DOMAIN\" is not a domain name."
[[ "$UPSTREAM" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] || fail "--upstream must be https://host"
[[ "$REF" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "--ref: \"$REF\" is not a branch or tag name."
[[ $EUID -eq 0 ]] || fail "run as root (with sudo)."
if [[ -n "${TESEL_POST_TOKEN:-}" ]]; then
  [[ "$TESEL_POST_TOKEN" =~ ^[a-z0-9][a-z0-9-]{0,31}:[0-9a-f]{48}$ ]] ||
    fail "TESEL_POST_TOKEN must be the NAME:TOKEN that post-certificate.sh grant printed."
elif [[ ! -s "$INSTALL_DIR/token" ]]; then
  fail "pass this post's token: sudo env TESEL_POST_TOKEN=NAME:TOKEN bash install.sh ...
Create it on the upstream server with: sudo /opt/tesel/post-certificate.sh grant NAME"
fi
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "debian" || "$ID" == "ubuntu" || "$ID" == "raspbian" || "${ID_LIKE:-}" == *debian* ]] ||
  fail "only Debian, Ubuntu and Raspberry Pi OS are supported."
if [[ -z "$WIFI_PASSWORD" ]]; then
  # Keep the password of an earlier run, so phones that already joined stay joined.
  WIFI_PASSWORD="$(nmcli -s -g 802-11-wireless-security.psk connection show tesel-post 2>/dev/null || true)"
fi
if [[ -z "$WIFI_PASSWORD" ]]; then
  random="$(head -c 256 /dev/urandom | LC_ALL=C tr -dc 'a-z0-9')"
  WIFI_PASSWORD="${random:0:10}"
fi
[[ ${#WIFI_PASSWORD} -ge 8 ]] || fail "the Wi-Fi password needs at least 8 characters."

step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
# Automatic updates may hold the package lock when this runs; wait up to 10 minutes for them.
APT_LOCK=(-o DPkg::Lock::Timeout=600)
APT_OPTIONS=(-yq "${APT_LOCK[@]}" -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get update -q "${APT_LOCK[@]}"
apt-get install "${APT_OPTIONS[@]}" ca-certificates curl jq openssl ufw network-manager dnsmasq-base

if [[ -z "$WIFI_INTERFACE" ]]; then
  WIFI_INTERFACE="$(nmcli -t -f DEVICE,TYPE device status | awk -F: '$2 == "wifi" {print $1; exit}')"
fi
[[ -n "$WIFI_INTERFACE" ]] || fail "no Wi-Fi device found. Pass one with --wifi-interface."

step "Installing Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  DOCKER_ID="$ID"
  [[ "$DOCKER_ID" == "raspbian" ]] && DOCKER_ID="debian"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$DOCKER_ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/$DOCKER_ID $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q "${APT_LOCK[@]}"
  apt-get install "${APT_OPTIONS[@]}" docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

step "Installing the command post in $INSTALL_DIR from $REF"
install -m 0755 -d "$INSTALL_DIR" "$INSTALL_DIR/maps"
install -m 0700 -d "$INSTALL_DIR/certs"
fetch() { curl -fsSL "$REPO_RAW/$REF/deploy/$1" -o "$INSTALL_DIR/$(basename "$1")"; }
for file in command-post/compose.yaml command-post/Caddyfile common/headers.caddy; do
  fetch "$file"
done
for script in command-post/refresh.sh common/update.sh common/install-cosign.sh; do
  fetch "$script"
  chmod 0755 "$INSTALL_DIR/$(basename "$script")"
done
"$INSTALL_DIR/install-cosign.sh"

# Settings live in .env, next to the images update.sh records there.
set_setting() {
  touch "$INSTALL_DIR/.env"
  sed -i "/^$1=/d" "$INSTALL_DIR/.env"
  echo "$1=$2" >> "$INSTALL_DIR/.env"
}
set_setting TESEL_DOMAIN "$DOMAIN"
set_setting TESEL_UPSTREAM "$UPSTREAM"
if [[ -n "${TESEL_POST_TOKEN:-}" ]]; then
  install -m 0600 /dev/null "$INSTALL_DIR/token"
  echo "$TESEL_POST_TOKEN" > "$INSTALL_DIR/token"
fi

step "Getting the certificate for $DOMAIN from $UPSTREAM and the latest images"
"$INSTALL_DIR/refresh.sh" "$INSTALL_DIR"
[[ -f "$INSTALL_DIR/certs/certificate.crt" ]] ||
  fail "no certificate for $DOMAIN: $UPSTREAM could not be reached. Connect to the internet and run this again."
# Caddy reads its configuration only when it starts: apply what was installed above.
(cd "$INSTALL_DIR" && docker compose exec --no-TTY caddy \
  caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile)
# Posts installed before ADR-0050 obtained the certificate themselves, holding the domain's DNS
# credentials. Now that the certificate comes from the server, those go, with lego's files.
sed -i '/^LEGO_/d' "$INSTALL_DIR/.env"
rm -rf "$INSTALL_DIR/dns.env" "$INSTALL_DIR/certs/accounts" "$INSTALL_DIR/certs/certificates"

# cosign, which update.sh runs, keeps Sigstore's trust root under $HOME, which systemd does not
# set for system services.
cat > /etc/systemd/system/tesel-post-refresh.service <<CONF
[Unit]
Description=Update the Tesel command post's certificate, image and map when there is internet
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=HOME=/root
ExecStart=$INSTALL_DIR/refresh.sh $INSTALL_DIR
CONF
cat > /etc/systemd/system/tesel-post-refresh.timer <<'CONF'
[Unit]
Description=Try to refresh the Tesel command post every 6 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=6h
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
CONF
systemctl daemon-reload
systemctl enable --now tesel-post-refresh.timer >/dev/null

step "Configuring the firewall: phones on the post's Wi-Fi reach the post and nothing else"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw default deny routed >/dev/null
# SSH only from the network the post is plugged into, never from its own Wi-Fi.
ufw deny in on "$WIFI_INTERFACE" to any port 22 proto tcp >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow in on "$WIFI_INTERFACE" to any port 53 >/dev/null
ufw allow in on "$WIFI_INTERFACE" to any port 67 proto udp >/dev/null
ufw --force enable >/dev/null

step "Making $DOMAIN point to this post on its Wi-Fi"
install -m 0755 -d /etc/NetworkManager/dnsmasq-shared.d
echo "address=/$DOMAIN/$POST_ADDRESS" > /etc/NetworkManager/dnsmasq-shared.d/tesel.conf
sed -i "/# tesel-post$/d" /etc/hosts
echo "$POST_ADDRESS $DOMAIN # tesel-post" >> /etc/hosts

step "Starting the post's Wi-Fi \"$WIFI_NAME\" on $WIFI_INTERFACE"
nmcli connection delete tesel-post >/dev/null 2>&1 || true
nmcli connection add type wifi ifname "$WIFI_INTERFACE" con-name tesel-post autoconnect yes \
  ssid "$WIFI_NAME" 802-11-wireless.mode ap 802-11-wireless.band bg \
  ipv4.method shared ipv4.addresses "$POST_ADDRESS/24" ipv6.method disabled \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$WIFI_PASSWORD" >/dev/null
nmcli connection up tesel-post >/dev/null ||
  fail "the Wi-Fi could not start as an access point. Some Wi-Fi chips cannot; try a USB Wi-Fi adapter."

step "Checking the post"
for _ in $(seq 1 30); do
  if curl -fsS --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    printf '\n\033[32mThe command post is ready.\033[0m\n'
    echo "  Wi-Fi:     $WIFI_NAME"
    echo "  Password:  $WIFI_PASSWORD"
    echo "  Address:   https://$DOMAIN/app/"
    echo "Phones join the Wi-Fi and open Tesel as usual, or the address above."
    exit 0
  fi
  sleep 2
done
fail "the post did not answer on https://$DOMAIN. See: cd $INSTALL_DIR && docker compose logs"
