#!/usr/bin/env bash
# Reports how a scheduled job of the server ended. A failure always goes to the journal; when
# TESEL_ALERT_URL is set in .env, every result is also sent there, in the way healthchecks.io
# and compatible services expect: the URL itself for success, the URL with "/fail" appended for
# a failure, the job's name in the body.
#
#   notify.sh success|failure UNIT
#
# The units of install.sh run it after each successful run (ExecStartPost) and, through
# tesel-notify@.service, when they fail (OnFailure).

set -euo pipefail

RESULT="${1:?usage: notify.sh success|failure UNIT}"
UNIT="${2:?usage: notify.sh success|failure UNIT}"

case "$RESULT" in
  success) path="" ;;
  failure)
    echo "$UNIT failed. See: journalctl -u $UNIT" >&2
    path="/fail"
    ;;
  *)
    echo "usage: notify.sh success|failure UNIT" >&2
    exit 2
    ;;
esac

[[ -n "${TESEL_ALERT_URL:-}" ]] || exit 0
# An unreachable alert service must not fail the job it reports on.
curl -fsS --max-time 10 --retry 3 --data-raw "$UNIT" "${TESEL_ALERT_URL%/}$path" >/dev/null ||
  echo "Could not reach TESEL_ALERT_URL to report that $UNIT ended in $RESULT." >&2
