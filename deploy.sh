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
# These headers used to live in next.config.mjs but Next.js ignores
# headers() under output: 'export', so the static host (nginx/Caddy) is
# responsible. See deploy/nginx-security-headers.conf for the recommended snippet.
#
# We verify BOTH presence AND expected value to prevent a misconfigured host
# from returning success while serving a permissive policy (e.g. an
# X-Frame-Options: ALLOWALL regression). CSP is checked for two critical
# directives (frame-ancestors 'none' + default-src 'self') rather than an
# exact string match, since the policy string is long and directive order
# may vary across hosts.
echo "→ Verifying security headers on $PUBLIC_URL..."
# curl -fsSLI follows redirects, so the response can contain multiple
# HTTP/ blocks (one per redirect hop). The awk script tracks the LAST
# ^HTTP/ line and accumulates body from there to EOF: each ^HTTP/ resets
# the body buffer, so an intermediate redirect's security headers are
# discarded. Without this fix, a redirect chain could yield a silent
# false positive — a header present only on an intermediate response would
# still print "all 5 security headers present" even though the final
# response lacks it.
# The trailing `|| true` masks curl/awk non-zero exit so `set -euo pipefail`
# doesn't abort before the warn-only handler runs (the exact case this
# check exists to catch).
response_headers="$(curl -fsSL -D - -o /dev/null --max-time 10 "$PUBLIC_URL/" 2>/dev/null | awk '/^HTTP\// { hdr = $0; body = ""; next } { body = body (body ? "\n" : "") $0 } END { printf "%s\n%s", hdr, body }' || true)"
if [[ -z "$response_headers" ]]; then
  echo "  ⚠ $PUBLIC_URL unreachable, skipping security-header check"
else
  # Two parallel plain arrays (not associative arrays) so the script stays
  # portable to Bash 3.x (macOS ships 3.2 by default). The empty entry for
  # content-security-policy is intentional — it is checked via critical
  # directives below instead of an exact-value compare.
  # Single array of "header:value" pairs — keeps header + its expected
  # value coupled together so a future reorder or addition can't silently
  # misalign them (Bash 3.x compatibility precludes associative arrays).
  # CSP's expected value is empty (verified via critical-directive check
  # below); the trailing ':' marks "no exact value compare".
  EXPECTED=(
    "x-content-type-options:nosniff"
    "x-frame-options:DENY"
    "referrer-policy:strict-origin-when-cross-origin"
    "permissions-policy:camera=(), microphone=(), geolocation()"
    "content-security-policy:"
  )
  missing_headers=()
  mismatched_headers=()
  for entry in "${EXPECTED[@]}"; do
    header="${entry%%:*}"
    expected_value="${entry#*:}"
    # Concatenate every matching header line. Some hosts emit duplicate
    # headers (e.g. multiple CSP lines merged via add_header) and `head -1`
    # would silently drop the later values.
    #
    # Separator choice:
    #   - CSP: '; ' — preserves directive boundaries across merged
    #     Content-Security-Policy headers (each header line is a separate
    #     directive; joining with space would lose the ';' that separates
    #     them, making our boundary-anchored CSP regex produce spurious
    #     false-positives when 'frame-ancestors '\''none'\'' or
    #     'default-src '\''self'\'' lands mid-string).
    #   - other headers: ' ' — single-value semantics; multi-line emission
    #     is unusual but space-joining is benign.
    # The trailing `|| true` is required: with `set -o pipefail`, a missing
    # header causes grep to exit 1, which would otherwise abort the whole
    # script via `set -e` — defeating the warn-only handler on the next lines.
    if [[ "$header" == "content-security-policy" ]]; then
      sep='; '
    else
      sep=' '
    fi
    actual_value=$(printf '%s\n' "$response_headers" \
      | grep -i "^${header}:" \
      | sed -E 's/^[^:]+:[[:space:]]*//; s/[[:space:]]+$//' \
      | tr -d '\r' \
      | paste -sd "$sep" - \
      || true)
    if [[ -z "$actual_value" ]]; then
      missing_headers+=("$header")
    elif [[ "$header" == "content-security-policy" ]]; then
      weak=0
      # Both critical directives must appear as standalone directives
      # (not as prefixed junk like "not-frame-ancestors ..." which browsers
      # ignore) and must END at their canonical value:
      #   - frame-ancestors 'none'  → followed by ; or end-of-string
      #     (rejects `frame-ancestors 'none' https://evil.example`)
      #   - default-src 'self'     → followed by ; or end-of-string
      #     (rejects `default-src 'self' https://evil.example`)
      # The boundary-anchored ERE catches both prefixed-junk and
      # extra-source regressions. Loop unrolled into explicit checks so
      # the diagnostic message names WHICH directive(s) actually failed
      # (the previous for-loop broke on first failure but the message
      # listed both, making policy troubleshooting harder).
      missing_directives=()
      if ! printf '%s' "$actual_value" \
            | grep -qiE "(^|[^a-z-])frame-ancestors[[:space:]]+'none'[[:space:]]*(;|$)"; then
        weak=1
        missing_directives+=("frame-ancestors 'none'")
      fi
      if ! printf '%s' "$actual_value" \
            | grep -qiE "(^|[^a-z-])default-src[[:space:]]+'self'[[:space:]]*(;|$)"; then
        weak=1
        missing_directives+=("default-src 'self'")
      fi
      if [[ $weak -eq 1 ]]; then
        mismatched_headers+=("$header (missing critical directive: ${missing_directives[*]})")
      fi
    else
      # Case-insensitive compare via POSIX tr (NOT bash's lowercase parameter
      # expansion, which requires Bash 4.0+ and would defeat this script's
      # stated Bash 3.x portability). RFC 7230 §3.2.4 says field-values are
      # case-insensitive; 'X-Frame-Options: deny' and 'X-Frame-Options: DENY'
      # are equivalent. Permissions-Policy spec
      # (https://w3c.github.io/webappsec-permissions-policy/) makes the same
      # promise for feature identifiers — 'camera', 'Camera', 'CAMERA' all
      # map to the registered feature 'camera' — so lowercasing is correct
      # here too and would NOT silently accept an inert typo.
      # Lowercased compare via POSIX tr is authoritative: if actual_lc
      # equals expected_lc we accept the values as case-insensitively
      # equal per RFC 7230 §3.2.4 ('X-Frame-Options: deny' and
      # 'X-Frame-Options: DENY' are equivalent). '|| printf …' is the
      # only fallback — it kicks in only if tr itself fails (very rare:
      # unsupported locale), in which case we surface the case-sensitive
      # mismatch as the safer default.
      actual_lc="$(printf '%s' "$actual_value"   | tr '[:upper:]' '[:lower:]' 2>/dev/null || printf '%s' "$actual_value")"
      expected_lc="$(printf '%s' "$expected_value" | tr '[:upper:]' '[:lower:]' 2>/dev/null || printf '%s' "$expected_value")"
      if [[ "$actual_lc" != "$expected_lc" ]]; then
        mismatched_headers+=("$header (expected '$expected_value', got '$actual_value')")
      fi
    fi
  done
  if [[ ${#missing_headers[@]} -gt 0 || ${#mismatched_headers[@]} -gt 0 ]]; then
    [[ ${#missing_headers[@]} -gt 0 ]] && echo "  ⚠ missing headers: ${missing_headers[*]}"
    [[ ${#mismatched_headers[@]} -gt 0 ]] && echo "  ⚠ mismatched headers: ${mismatched_headers[*]}"
    echo "    These must be configured at the static host (nginx/Caddy)."
    echo "    See deploy/nginx-security-headers.conf for the recommended snippet."
  else
    # Success line intentionally reflects partial CSP coverage (only the two
    # critical directives are checked), to avoid overstating verification.
    echo "  ✓ all 5 security headers present (CSP verified for critical directives)"
  fi
fi

if [[ "$DEPLOY_MODE" == "remote" ]]; then
  echo "✓ Deploy complete → $PUBLIC_URL (host: $HOST)"
else
  echo "✓ Deploy complete → $PUBLIC_URL (local)"
fi
