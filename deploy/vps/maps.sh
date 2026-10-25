#!/usr/bin/env bash
# Builds the base map the server publishes at /maps/basemap.pmtiles: an extract of the latest
# Protomaps daily build of OpenStreetMap (ADR-0007), for the area in TESELIA_MAP_BBOX.
#
#   maps.sh [DIRECTORY]
#
# The new file replaces the old one only once complete, so the map never disappears. Run by
# install.sh the first time and by teselia-maps.timer every month after.

set -euo pipefail

DIR="${1:-/opt/teselia/maps}"
# West, south, east, north. Default: Spain and Portugal, Balearic and Canary Islands.
BBOX="${TESELIA_MAP_BBOX:--18.4,27.4,4.6,44.0}"
IMAGE="protomaps/go-pmtiles:latest"

# Daily builds are kept for a while; take the newest one that exists.
url=""
for days_ago in $(seq 1 14); do
  candidate="https://build.protomaps.com/$(date -u -d "$days_ago days ago" +%Y%m%d).pmtiles"
  if curl -fsI "$candidate" >/dev/null 2>&1; then
    url="$candidate"
    break
  fi
done
[[ -n "$url" ]] || { echo "No Protomaps build found in the last two weeks." >&2; exit 1; }

install -m 0755 -d "$DIR"
rm -f "$DIR/basemap.pmtiles.new"
echo "Extracting $BBOX from $url (this takes a while)"
docker run --rm -v "$DIR:/maps" "$IMAGE" extract "$url" /maps/basemap.pmtiles.new --bbox="$BBOX"
chmod 0644 "$DIR/basemap.pmtiles.new"
mv "$DIR/basemap.pmtiles.new" "$DIR/basemap.pmtiles"
echo "Base map ready: $(du -h "$DIR/basemap.pmtiles" | cut -f1)"
