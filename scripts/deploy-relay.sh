#!/bin/sh
# Redeploy the relay (relay/, a Cloudflare Worker serving the phone's web app) so the phone's page
# matches the web build this checkout's app serves. Run by both install scripts after the install;
# never fails them: offline or logged out of Cloudflare only skips the relay.
#
# PERCH_SKIP_RELAY=1 skips it. A stamp of what was last deployed (web build, Worker source and
# config) skips the deploy when nothing changed; PERCH_RELAY_FORCE=1 ignores the stamp, e.g. after
# switching Cloudflare accounts. Needs `npm run build` first (packages/web/dist).
set -u
cd "$(dirname "$0")/.."

STAMP=relay/.wrangler/deployed.sha
relay_hash() { find packages/web/dist relay/src relay/wrangler.toml -type f -exec shasum {} + | LC_ALL=C sort | shasum | cut -d' ' -f1; }
if [ "${PERCH_SKIP_RELAY:-}" = 1 ]; then
  echo "Skipping relay deploy (PERCH_SKIP_RELAY=1)"
  exit 0
fi
if [ ! -d packages/web/dist ]; then
  echo "Relay not deployed: no web build (run npm run build first)" >&2
  exit 0
fi
want="$(relay_hash)"
if [ "${PERCH_RELAY_FORCE:-}" != 1 ] && [ "$(cat "$STAMP" 2>/dev/null || true)" = "$want" ]; then
  echo "Relay already up to date (PERCH_RELAY_FORCE=1 to redeploy)"
  exit 0
fi
echo "Deploying relay…"
(cd relay && { [ -d node_modules ] || npm install; } && npx wrangler deploy) \
  && { mkdir -p "$(dirname "$STAMP")" && echo "$want" > "$STAMP"; } \
  || echo "Relay deploy failed; the app is installed. Retry: (cd relay && npx wrangler login && npx wrangler deploy)" >&2
exit 0
