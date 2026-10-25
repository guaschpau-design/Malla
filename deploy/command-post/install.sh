#!/usr/bin/env bash
# Turns a Debian, Ubuntu or Raspberry Pi OS computer with Wi-Fi into a Teselia command post:
# its own Wi-Fi network, the app and a relay that replicates the group's server whenever the
# computer has internet (docs/decisions/0018-command-post.md).
#
#   sudo env IONOS_API_KEY=prefix.secret bash install.sh \
#     --domain puesto.teselia.eu --upstream https://teselia.eu \
#     --dns ionos --dns-var IONOS_API_KEY --email you@example.eu
#
# Run it with internet, by cable or USB tethering if possible: it downloads everything the post
# needs and turns the Wi-Fi into the post's network at the very end. Safe to run again.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/guaschpau-design/Malla"
REF="main"
INSTALL_DIR="/opt/teselia-post"
POST_ADDRESS="10.42.0.1"
LEGO_IMAGE="goacme/lego:latest"
DOMAIN=""
UPSTREAM=""
DNS_PROVIDER=""
DNS_VARS=()
EMAIL=""
WIFI_NAME="Teselia"
WIFI_PASSWORD=""
WIFI_INTERFACE=""

usage() {
  cat >&2 <<'TEXT'
Usage: install.sh --domain NAME --upstream URL --dns PROVIDER --dns-var VARIABLE... --email EMAIL
                  [--wifi-name NAME] [--wifi-password PASSWORD] [--wifi-interface IFACE]
                  [--ref GIT_REF]

  --domain     Name of the post, the same for every post of a server, e.g. puesto.teselia.eu
  --upstream   The group's server, e.g. https://teselia.eu
  --dns        lego DNS provider of the domain, e.g. ionos (go-acme.github.io/lego/dns)
  --dns-var    Name of an environment variable holding a DNS API credential; repeat as needed
  --email      Contact address for the certificate authority
TEXT
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --upstream) UPSTREAM="${2:-}"; shift 2 ;;
    --dns) DNS_PROVIDER="${2:-}"; shift 2 ;;
    --dns-var) DNS_VARS+=("${2:-}"); shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --wifi-name) WIFI_NAME="${2:-}"; shift 2 ;;
    --wifi-password) WIFI_PASSWORD="${2:-}"; shift 2 ;;
    --wifi-interface) WIFI_INTERFACE="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -n "$DOMAIN" && -n "$UPSTREAM" && -n "$DNS_PROVIDER" && -n "$EMAIL" ]] || usage
[[ ${#DNS_VARS[@]} -gt 0 ]] || usage
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "\"$DOMAIN\" is not a domain name."
[[ "$UPSTREAM" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] || fail "--upstream must be https://host"
[[ $EUID -eq 0 ]] || fail "run as root (with sudo)."
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "debian" || "$ID" == "ubuntu" || "$ID" == "raspbian" || "${ID_LIKE:-}" == *debian* ]] ||
  fail "only Debian, Ubuntu and Raspberry Pi OS are supported."
for variable in "${DNS_VARS[@]}"; do
  [[ -n "${!variable:-}" ]] || fail "the environment variable $variable is empty. Pass it with sudo env $variable=..."
done
if [[ -z "$WIFI_PASSWORD" ]]; then
  WIFI_PASSWORD="$(tr -dc 'a-z0-9' </dev/urandom | head -c 10)"
fi
[[ ${#WIFI_PASSWORD} -ge 8 ]] || fail "the Wi-Fi password needs at least 8 characters."

step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
APT_OPTIONS=(-yq -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get update -q
apt-get install "${APT_OPTIONS[@]}" ca-certificates curl ufw network-manager dnsmasq-base

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
  apt-get update -q
  apt-get install "${APT_OPTIONS[@]}" docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

step "Installing the command post in $INSTALL_DIR"
install -m 0755 -d "$INSTALL_DIR" "$INSTALL_DIR/certs"
for file in compose.yaml Caddyfile; do
  curl -fsSL "$REPO_RAW/$REF/deploy/command-post/$file" -o "$INSTALL_DIR/$file"
done
cat > "$INSTALL_DIR/.env" <<CONF
TESELIA_DOMAIN=$DOMAIN
TESELIA_UPSTREAM=$UPSTREAM
LEGO_EMAIL=$EMAIL
LEGO_DNS=$DNS_PROVIDER
CONF
# DNS credentials can change the domain's records: readable by root only.
install -m 0600 /dev/null "$INSTALL_DIR/dns.env"
for variable in "${DNS_VARS[@]}"; do
  printf '%s=%s\n' "$variable" "${!variable}" >> "$INSTALL_DIR/dns.env"
done

# Run by the timer below too: renews the certificate and updates the images whenever there is
# internet, and does nothing harmful when there is none.
cat > "$INSTALL_DIR/refresh.sh" <<SCRIPT
#!/usr/bin/env bash
set -uo pipefail
cd "$INSTALL_DIR" || exit 1
# shellcheck source=/dev/null
. ./.env
lego() {
  docker run --rm --env-file dns.env -v "$INSTALL_DIR/certs:/certs" $LEGO_IMAGE \\
    --path /certs --email "\$LEGO_EMAIL" --accept-tos --dns "\$LEGO_DNS" --domains "\$TESELIA_DOMAIN" "\$@"
}
if [[ -f "certs/certificates/\$TESELIA_DOMAIN.crt" ]]; then
  lego renew --days 30 && docker compose restart caddy >/dev/null 2>&1
else
  lego run
fi
docker compose pull --quiet && docker compose up --detach --remove-orphans
docker image prune --force >/dev/null
SCRIPT
chmod 0700 "$INSTALL_DIR/refresh.sh"

step "Getting the certificate for $DOMAIN and the latest images"
docker pull --quiet "$LEGO_IMAGE" >/dev/null
"$INSTALL_DIR/refresh.sh"
[[ -f "$INSTALL_DIR/certs/certificates/$DOMAIN.crt" ]] ||
  fail "no certificate for $DOMAIN. Check the DNS provider name and its credentials, then run this again."

cat > /etc/systemd/system/teselia-post-refresh.service <<CONF
[Unit]
Description=Renew the command post certificate and update Teselia when there is internet
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$INSTALL_DIR/refresh.sh
CONF
cat > /etc/systemd/system/teselia-post-refresh.timer <<'CONF'
[Unit]
Description=Try to refresh the Teselia command post every 6 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=6h
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
CONF
systemctl daemon-reload
systemctl enable --now teselia-post-refresh.timer >/dev/null

step "Configuring the firewall: phones on the post's Wi-Fi reach the post and nothing else"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw default deny routed >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow in on "$WIFI_INTERFACE" to any port 53 >/dev/null
ufw allow in on "$WIFI_INTERFACE" to any port 67 proto udp >/dev/null
ufw --force enable >/dev/null

step "Making $DOMAIN point to this post on its Wi-Fi"
install -m 0755 -d /etc/NetworkManager/dnsmasq-shared.d
echo "address=/$DOMAIN/$POST_ADDRESS" > /etc/NetworkManager/dnsmasq-shared.d/teselia.conf
sed -i "/# teselia-post$/d" /etc/hosts
echo "$POST_ADDRESS $DOMAIN # teselia-post" >> /etc/hosts

step "Starting the post's Wi-Fi \"$WIFI_NAME\" on $WIFI_INTERFACE"
nmcli connection delete teselia-post >/dev/null 2>&1 || true
nmcli connection add type wifi ifname "$WIFI_INTERFACE" con-name teselia-post autoconnect yes \
  ssid "$WIFI_NAME" 802-11-wireless.mode ap 802-11-wireless.band bg \
  ipv4.method shared ipv4.addresses "$POST_ADDRESS/24" ipv6.method disabled \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$WIFI_PASSWORD" >/dev/null
nmcli connection up teselia-post >/dev/null ||
  fail "the Wi-Fi could not start as an access point. Some Wi-Fi chips cannot; try a USB Wi-Fi adapter."

step "Checking the post"
for _ in $(seq 1 30); do
  if curl -fsS --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    printf '\n\033[32mThe command post is ready.\033[0m\n'
    echo "  Wi-Fi:     $WIFI_NAME"
    echo "  Password:  $WIFI_PASSWORD"
    echo "  Address:   https://$DOMAIN/app/"
    echo "Phones join the Wi-Fi and open Teselia as usual, or the address above."
    exit 0
  fi
  sleep 2
done
fail "the post did not answer on https://$DOMAIN. See: cd $INSTALL_DIR && docker compose logs"
