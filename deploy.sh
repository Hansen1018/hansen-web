#!/usr/bin/env bash
# Deploy hansen-web static export.
# Auto-detects deploy mode from arguments:
#   ./deploy.sh                  # local — this host is the VPS, rsync directly
#   ./deploy.sh user@host        # remote — SSH + remote rsync (for deploying to a different host)
#
# Environment overrides:
#   PUBLIC_URL — healthcheck URL (default https://hansendong.top)
#   LOCAL_PORT — fallback local healthcheck port (default 8081)
#   REMOTE_DIR — override destination path (default /var/www/hansen-web)
#   LOCAL_OUT  — override build output dir (default out)

set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/var/www/hansen-web}"
LOCAL_OUT="${LOCAL_OUT:-out}"
PUBLIC_URL="${PUBLIC_URL:-https://hansendong.top}"
LOCAL_PORT="${LOCAL_PORT:-8081}"

# Deploy mode selection
if [[ -n "${1:-}" ]]; then
  DEPLOY_MODE="remote"
  HOST="$1"
  HOSTNAME="${HOST##*@}"
else
  DEPLOY_MODE="local"
fi

# 1. Local build
echo "→ Building..."
npm run build

# 2. Atomic deploy (prevents serving half-written files)
if [[ "$DEPLOY_MODE" == "remote" ]]; then
  echo "→ Uploading to $HOST (atomic via tmp dir)..."
  ssh "$HOST" "mkdir -p $REMOTE_DIR.tmp"
  rsync -a --delete "$LOCAL_OUT/" "$HOST:$REMOTE_DIR.tmp/"
  ssh "$HOST" "rm -rf $REMOTE_DIR && mv $REMOTE_DIR.tmp $REMOTE_DIR"
else
  echo "→ Deploying locally to $REMOTE_DIR (atomic via tmp dir)..."
  mkdir -p "$REMOTE_DIR.tmp"
  rsync -a --delete "$LOCAL_OUT/" "$REMOTE_DIR.tmp/"
  rm -rf "$REMOTE_DIR"
  mv "$REMOTE_DIR.tmp" "$REMOTE_DIR"
fi

# 3. Post-deploy healthcheck (external first, fall back to local port)
echo "→ Healthcheck ($PUBLIC_URL)..."
if ! curl -fsSI --max-time 10 "$PUBLIC_URL/" >/dev/null 2>&1; then
  echo "  ⚠ $PUBLIC_URL unreachable, trying http://localhost:$LOCAL_PORT/..."
  if ! curl -fsSI --max-time 10 "http://localhost:$LOCAL_PORT/" >/dev/null 2>&1; then
    echo "✗ post-deploy healthcheck failed (tried $PUBLIC_URL + localhost:$LOCAL_PORT)" >&2
    exit 1
  fi
  echo "  ✓ localhost responded"
fi

# 4. Security-header verification (best-effort: warn only, never block deploy).
# These four headers used to live in next.config.mjs but Next.js ignores
# headers() under output: 'export', so the static host (nginx/Caddy) is
# responsible. See deploy/nginx-security-headers.conf for the recommended snippet.
echo "→ Verifying security headers on $PUBLIC_URL..."
response_headers="$(curl -fsSI --max-time 10 "$PUBLIC_URL/" 2>/dev/null || true)"
if [[ -z "$response_headers" ]]; then
  echo "  ⚠ $PUBLIC_URL unreachable, skipping security-header check"
else
  missing_headers=()
  for header in content-security-policy x-frame-options referrer-policy permissions-policy; do
    if ! printf '%s\n' "$response_headers" | grep -qi "^${header}:"; then
      missing_headers+=("$header")
    fi
  done
  if [[ ${#missing_headers[@]} -gt 0 ]]; then
    echo "  ⚠ missing security headers: ${missing_headers[*]}"
    echo "    These must be configured at the static host (nginx/Caddy)."
    echo "    See deploy/nginx-security-headers.conf for the recommended snippet."
  else
    echo "  ✓ all 4 security headers present"
  fi
fi

if [[ "$DEPLOY_MODE" == "remote" ]]; then
  echo "✓ Deploy complete → $PUBLIC_URL (host: $HOST)"
else
  echo "✓ Deploy complete → $PUBLIC_URL (local)"
fi
