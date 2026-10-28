#!/usr/bin/env bash
# Installs cosign, with which update.sh checks that a server image was built and signed by this
# repository's CI before running it (docs/decisions/0049-signed-images-and-checked-updates.md).
# The version is pinned and the download checked against the checksums published with it.
#
#   install-cosign.sh
#
# Run by the VPS installer; does nothing when it is installed.

set -euo pipefail

VERSION="3.1.4"
# From cosign_checksums.txt of the release, for the architectures the server image is built for.
declare -A SHA256=(
  [amd64]="424e2c97d0b45fd7a6b608a87f090f35633f4c23ece5f092d48bba11aaf4bbfa"
  [arm64]="ade83b7aac62e131cacfe96d958948b2150cc9efec46a570a2649b8e27dedad2"
)

if [[ "$(cosign version 2>/dev/null | awk '$1 == "GitVersion:" {print $2}')" == "v$VERSION" ]]; then
  exit 0
fi

arch="$(dpkg --print-architecture)"
[[ -n "${SHA256[$arch]:-}" ]] || {
  echo "cosign: Tesel's server image is not built for $arch." >&2
  exit 1
}
download="$(mktemp)"
trap 'rm -f "$download"' EXIT
curl -fsSL "https://github.com/sigstore/cosign/releases/download/v$VERSION/cosign-linux-$arch" \
  -o "$download"
echo "${SHA256[$arch]}  $download" | sha256sum --check --quiet -
install -m 0755 "$download" /usr/local/bin/cosign
echo "cosign $VERSION installed."
