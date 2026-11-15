#!/usr/bin/env bash
# Deploy hansen-web static export.
# Auto-detects deploy mode from arguments:
#   ./deploy.sh                  # local — this host is the VPS, rsync directly
#   ./deploy.sh user@host        # remote — SSH + remote rsync (for deploying to a different host)
#
# Environment overrides:
#   PUBLIC_URL — healthcheck URL (default https://hansendong.top)
#   LOCAL_PORT — fallback local healthcheck port (default 8081)
#   REMOTE_DIR — override destination path (default /var/www/hansen-web).
#                A local deploy accepts a relative path ("site", "./site",
#                "out/../site"), but refuses ".", "..", any path with a
#                ".." component, and any path that starts with "-": those
#                are refused before the build, not after it.
#   LOCAL_OUT  — override build output dir (default out)

set -euo pipefail

# The CSP critical-directive rules live in deploy/csp-assert.sh so that this
# verifier and tests/deploy/csp-assert.test.ts exercise one implementation
# instead of two copies that can drift apart. See that file for the measured
# evidence behind each rule.
CSP_ASSERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSP_ASSERT_SH="$CSP_ASSERT_DIR/deploy/csp-assert.sh"
if [[ ! -f "$CSP_ASSERT_SH" ]]; then
  echo "✗ missing $CSP_ASSERT_SH (deploy.sh needs a full repo checkout)" >&2
  exit 1
fi
. "$CSP_ASSERT_SH"

# The blog hand-over lives in deploy/blog-handover.sh for the same reason:
# the local branch runs it directly and the remote branch ships that same
# file to the host over stdin, so the two paths cannot drift apart.
BLOG_HANDOVER_SH="$CSP_ASSERT_DIR/deploy/blog-handover.sh"
if [[ ! -f "$BLOG_HANDOVER_SH" ]]; then
  echo "✗ missing $BLOG_HANDOVER_SH (deploy.sh needs a full repo checkout)" >&2
  exit 1
fi
. "$BLOG_HANDOVER_SH"

REMOTE_DIR="${REMOTE_DIR:-/var/www/hansen-web}"
LOCAL_OUT="${LOCAL_OUT:-out}"
PUBLIC_URL="${PUBLIC_URL:-https://hansendong.top}"
LOCAL_PORT="${LOCAL_PORT:-8081}"

# remote_quote PATH
#
# Print PATH quoted for the remote shell, so a path that contains a space or a
# quote survives the word splitting the remote shell performs on the command
# string. REMOTE_DIR is overridable through the environment, so this is not
# hypothetical: measured, an unquoted REMOTE_DIR containing a space made the
# remote guard fail with "too many arguments", so the blog hand-over was
# skipped without an error, and the same word splitting reached the
# "rm -rf $REMOTE_DIR" line, which deletes the wrong paths.
remote_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

# The path rules live in deploy/blog-handover.sh, which deploy.sh sources
# above, so there is ONE implementation of what a safe path is: the module
# checks the two roots it is given, and deploy.sh checks REMOTE_DIR with the
# same functions. Two validators that disagree about what is safe are worse
# than one.
#
# --- remote path validation (begin) ---
validate_remote_dir() {
  bh_path_is_safe "$1" 'REMOTE_DIR'
}
require_absolute_path() {
  case "$1" in
    /*) return 0 ;;
    *)
      echo "✗ ${2:-REMOTE_DIR} must be an absolute path in remote mode (got: $1)" >&2
      return 1
      ;;
  esac
}
# --- remote path validation (end) ---

# Deploy mode selection
if [[ -n "${1:-}" ]]; then
  DEPLOY_MODE="remote"
  HOST="$1"
  HOSTNAME="${HOST##*@}"
else
  DEPLOY_MODE="local"
fi

# HOST is typed by the operator and reaches ssh and rsync as a remote
# spec. Whitespace in it splits that spec, so it is refused here rather
# than quoted into the wrong place.
if [[ "$DEPLOY_MODE" == "remote" ]]; then
  case "$HOST" in
    -*)
      # The host is the first positional to ssh and rsync, so a value that
      # starts with "-" would be read as an OPTION ("-oProxyCommand=...").
      echo "✗ the host must not start with '-' (got: $HOST)" >&2
      exit 1
      ;;
    *[[:space:]]*)
      echo "✗ the host must not contain whitespace (got: $HOST)" >&2
      exit 1
      ;;
  esac
fi

# Checked before the build, so a bad path fails in a second rather than
# after a full build, and long before anything is deleted. The trimmed path
# is used from here on, so the staging directory is derived from the same
# string the swap deletes: "/var/www/site/" would otherwise derive
# "/var/www/site/.tmp", a directory INSIDE the live web root.
#
# The absolute-path requirement applies to the remote branch only. There the
# path crosses to another host, so a relative one would name something else
# entirely, and ".." would be resolved against that host's tree. A local
# deploy never leaves this host, so "./site", "out/../site" and "site/"
# all keep working.
if [[ "$DEPLOY_MODE" == "remote" ]]; then
  # The ".." check runs on the value AS IT WAS GIVEN: folding it away
  # first would hide the very component the check is about.
  require_no_parent_refs "$REMOTE_DIR" 'REMOTE_DIR' || exit 1
fi
REMOTE_DIR="$(bh_fold_path "$REMOTE_DIR")"
validate_remote_dir "$REMOTE_DIR" || exit 1
if [[ "$DEPLOY_MODE" == "remote" ]]; then
  require_absolute_path "$REMOTE_DIR" 'REMOTE_DIR' || exit 1
fi

# 1. Local build
echo "→ Building..."
npm run build

# 2. Atomic deploy (prevents serving half-written files)
if [[ "$DEPLOY_MODE" == "remote" ]]; then
  echo "→ Uploading to $HOST (atomic via tmp dir)..."
  # REMOTE_DIR was normalized and validated above: in remote mode it is
  # absolute, it is not the root, it carries no "." or ".." component, and
  # its trailing slashes are gone, so the staging path derived from it is
  # the sibling REMOTE_DIR.tmp and not REMOTE_DIR/.tmp.
  #
  # What is left can still contain a space or a quote, so every path that
  # reaches the remote shell is quoted with remote_quote, whose comment
  # carries the measurement behind that quoting. rsync builds its own remote
  # command line and escapes the path itself, so it needs nothing extra:
  # measured with rsync 3.2.7, a remote path with a space or a shell
  # metacharacter arrives at the remote shell as ONE backslash-escaped
  # word ("/var/www/my\ site/blog/"), so it cannot split into another
  # argument or become a command.
  REMOTE_DIR_Q="$(remote_quote "$REMOTE_DIR")"
  REMOTE_DIR_TMP_Q="$(remote_quote "$REMOTE_DIR.tmp")"
  ssh "$HOST" "mkdir -p ${REMOTE_DIR_TMP_Q}"
  rsync -a --delete "$LOCAL_OUT/" "$HOST:$REMOTE_DIR.tmp/"
  # The Hugo blog repo deploys blog/feed.json into this same web root
  # (its deploy.sh sets WEB_DIR=/var/www/hansen-web). Carry it into the
  # staging dir so the atomic swap below does not drop it.
  #
  # The hand-over runs on the host, from the same file the local branch
  # sources, so the two paths cannot drift apart.
  #
  # It is fed to the host over stdin, and stdin can arrive empty or
  # truncated: the remote shell would run an empty script, exit 0 and
  # print nothing, and the swap below would drop blog/ with a green
  # deploy. So the remote side prints a confirmation and it is checked.
  handover_module="$(cat "$BLOG_HANDOVER_SH")" || {
    echo "✗ could not read $BLOG_HANDOVER_SH" >&2
    exit 1
  }
  handover_script="$(printf '%s\n%s\n' "$handover_module" 'stage_blog_into_staging "$1" "$2" || exit 1')"
  # stdout alone is captured, because the confirmation is the only thing
  # written there. The remote's diagnostics go to stderr, which reaches
  # this terminal directly, so a refusal is shown to the operator as it
  # happens instead of being swallowed into a variable.
  # The exit status is captured, not acted on: the confirmation below is
  # what decides. A pipeline can be non-zero because the local writer
  # got SIGPIPE while the remote had already succeeded, and that must
  # not abort a hand-over that worked.
  handover_status=0
  handover_out="$(printf '%s\n' "$handover_script" | ssh "$HOST" "sh -s -- ${REMOTE_DIR_Q} ${REMOTE_DIR_TMP_Q}")" || handover_status=$?
  # The expected confirmations come from the module's own functions, so the
  # wording lives in one place and the comparison is EXACT. A prefix match
  # would accept a stdout that merely starts with the marker.
  # The guarantee is therefore: stdout must match exactly, otherwise the
  # swap is refused. An empty, truncated or otherwise unexpected stdout
  # matches neither marker and refuses the deploy.
  # The remote side trims the path it is given before it builds the
  # marker, so the expected marker is built from the trimmed path as
  # well. Both sides then compute the same string, and the exact
  # comparison does not depend on the two spellings happening to be
  # equal.
  expected_ok="$(bh_marker_ok "$(bh_trim_path "$REMOTE_DIR")")"
  # The "no blog/" marker carries the path the remote inspected, so the
  # operator can see WHICH web root was looked at, and a remote that
  # inspected a different root does not match this marker.
  expected_noblog="$(bh_marker_noblog "$(bh_trim_path "$REMOTE_DIR")")"
  # The "no web root" marker is a different fact from the "no blog/" marker:
  # the live web root is not there at all (a first deploy to a host that
  # has nothing yet), versus a web root that IS there without the blog.
  # Saying which one it is means a mistyped REMOTE_DIR is visible instead
  # of silent.
  expected_noroot="$(bh_marker_noroot "$(bh_trim_path "$REMOTE_DIR")")"
  case "$handover_out" in
    "$expected_ok")
      ;;
    "$expected_noblog")
      echo "  ⚠ the live web root $(bh_trim_path "$REMOTE_DIR") has no blog/ to carry over" >&2
      ;;
    "$expected_noroot")
      echo "  ⚠ the live web root $(bh_trim_path "$REMOTE_DIR") does not exist on $HOST; nothing to carry over" >&2
      ;;
    *)
      echo "✗ the blog hand-over did not report success on $HOST (ssh exit $handover_status); refusing to swap" >&2
      exit 1
      ;;
  esac
  ssh "$HOST" "rm -rf ${REMOTE_DIR_Q} && mv ${REMOTE_DIR_TMP_Q} ${REMOTE_DIR_Q}"
else
  echo "→ Deploying locally to $REMOTE_DIR (atomic via tmp dir)..."
  mkdir -p "$REMOTE_DIR.tmp"
  rsync -a --delete "$LOCAL_OUT/" "$REMOTE_DIR.tmp/"
  # The Hugo blog repo deploys blog/feed.json into this same web root
  # (its deploy.sh sets WEB_DIR=/var/www/hansen-web). Carry it into the
  # staging dir so the atomic swap below does not drop it.
  # The hand-over refuses rather than swapping: if it fails, the live
  # blog/ would be dropped by the swap below, so the swap does not run.
  # The check is explicit rather than left to "set -e", so it keeps
  # protecting the swap if this line is ever moved into an if/|| block.
  # The staging tree is left in place when the hand-over refuses: the
  # module removed the partial blog/ copy it made, and the next run
  # refreshes the whole staging tree with "rsync --delete".
  if ! stage_blog_into_staging "$REMOTE_DIR" "$REMOTE_DIR.tmp"; then
    echo "✗ the blog hand-over failed; refusing to swap" >&2
    exit 1
  fi
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
# X-Frame-Options: ALLOWALL regression). CSP is not compared as one exact
# string -- the policy string is long and directive order may vary across
# hosts -- but against the individual critical rules in
# deploy/csp-assert.sh: frame-ancestors 'none', default-src 'self', and the
# CDN origins the deployed trees actually load.
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
response_headers="$(curl -fsSL -D - -o /dev/null --max-time 10 "$PUBLIC_URL/" 2>/dev/null | awk '/^HTTP\// { hdr = $0; tail = ""; next } { tail = tail (tail ? "\n" : "") $0 } END { if (hdr != "") printf "%s%s%s", hdr, (tail ? "\n" : ""), tail }' || true)"
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
  # below); the trailing ':' in 'content-security-policy:' marks
  # "no exact value compare".
  EXPECTED=(
    "x-content-type-options:nosniff"
    "x-frame-options:DENY"
    "referrer-policy:strict-origin-when-cross-origin"
    "permissions-policy:camera=(), microphone=(), geolocation=()"
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
    if [[ "$(printf %s "$header" | tr "[:upper:]" "[:lower:]")" == "content-security-policy" ]]; then
      sep='; '
    else
      sep=' '
    fi
    actual_value=$(printf '%s\n' "$response_headers" \
      | sed 's/^[[:space:]]*//' \
      | grep -i "^${header}:" \
      | sed -E 's/^[^:]+:[[:space:]]*//; s/[[:space:]]+$//' \
      | tr -d '\r' \
      | sort -u \
      | { if [[ "$sep" == "; " ]]; then paste -sd ';' - | sed 's/;/; /g'; else paste -sd "$sep" -; fi; } \
      || true)
    if [[ -z "$actual_value" ]]; then
      missing_headers+=("$header")
    elif [[ "$(printf %s "$header" | tr "[:upper:]" "[:lower:]")" == "content-security-policy" ]]; then
      weak=0
      # Every critical rule is anchored on a CSP token boundary, so a
      # directive must appear as a standalone directive (not as prefixed
      # junk like "not-frame-ancestors ...", which browsers ignore), a
      # canonical value must END at its boundary, and a whitelisted origin
      # must match as a whole host rather than a lookalike prefix. The
      # rules themselves live in deploy/csp-assert.sh; the diagnostic
      # message names WHICH rule(s) actually failed, so policy
      # troubleshooting does not have to re-run the check by hand.
      # --- CSP critical-directive verification (begin) ---
      # The rules live in deploy/csp-assert.sh, shared with
      # tests/deploy/csp-assert.test.ts, so the verifier and its test
      # exercise one implementation. They are anchored to what the deployed
      # trees actually load, measured on both sites; see that file for the
      # evidence behind each rule.
      missing_directives="$(csp_missing_directives "$actual_value" || true)"
      missing_directives="${missing_directives//$'\n'/ }"
      if [[ -n "$missing_directives" ]]; then
        weak=1
      fi
      # --- CSP critical-directive verification (end) ---

      if [[ $weak -eq 1 ]]; then
        mismatched_headers+=("$header (missing critical directive: $missing_directives)")
      fi
    else
      # Case-insensitive compare per RFC 7230 §3.2.4 via POSIX tr (Bash 3.x
      # portable; ${var,,} requires Bash 4+). '|| printf' is a defensive
      # fallback for the very-rare case that tr itself fails.
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
    # The success line reports how many critical rules were checked, and
    # the count comes from the rule module, so the text the operator reads
    # and the rules that actually run cannot drift apart. It is not a
    # claim about the whole policy.
    echo "  ✓ all ${#EXPECTED[@]} security headers present (CSP verified for $(csp_rule_count) critical rules)"
  fi
fi

if [[ "$DEPLOY_MODE" == "remote" ]]; then
  echo "✓ Deploy complete → $PUBLIC_URL (host: $HOST)"
else
  echo "✓ Deploy complete → $PUBLIC_URL (local)"
fi
