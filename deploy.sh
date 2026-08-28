#!/usr/bin/env bash
# Deploy hansen-web static export to VPS
# Usage: ./deploy.sh user@host

set -euo pipefail

HOST="${1:?usage: ./deploy.sh user@host}"
REMOTE_DIR="/var/www/hansen-web"
LOCAL_OUT="out"
PUBLIC_URL="${PUBLIC_URL:-https://hansendong.top}"

# Strip user@ from HOST for logging URLs
HOSTNAME="${HOST##*@}"

# 1. Local build
echo "→ Building..."
npm run build

# 2. Upload out/ to server (atomic via tmp dir, avoids serving half-written files)
echo "→ Uploading to $HOST..."
ssh "$HOST" "mkdir -p $REMOTE_DIR.tmp"
rsync -a --delete "$LOCAL_OUT/" "$HOST:$REMOTE_DIR.tmp/"
ssh "$HOST" "rm -rf $REMOTE_DIR && mv $REMOTE_DIR.tmp $REMOTE_DIR"

# 3. Post-deploy healthcheck
echo "→ Healthcheck..."
if ! curl -fsSI --max-time 10 "$PUBLIC_URL/" >/dev/null; then
  echo "✗ post-deploy healthcheck failed: $PUBLIC_URL did not return 2xx" >&2
  exit 1
fi

echo "✓ Deploy complete → $PUBLIC_URL"
