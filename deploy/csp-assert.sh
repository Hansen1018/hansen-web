#!/usr/bin/env bash
# CSP critical-directive rules for the shared static-host policy.
#
# Source-only: this file defines two functions and calls nothing.
# deploy.sh sources it and tests/deploy/csp-assert.test.ts drives it, so the
# verifier and its test exercise one implementation instead of two copies
# that can drift apart.
#
# Why the rules are written down at all: a verifier nobody can test is a
# comment. PR #26 removed two connect-src assertions on the grounds that
# this project never contacts the two CDN origins. That measurement was
# scoped to one of the two sites this policy serves, so the conclusion did
# not hold and the PR was withdrawn. The rules below are anchored to what
# the deployed trees actually load, measured on both sites on 2026-11-15.
#
# Measured requirements:
#
#   connect-src + https://cdn.jsdelivr.net
#     Artalk.js v2 ships a default `emoticons` list URL pointing at
#     https://cdn.jsdelivr.net/gh/ArtalkJS/Emoticons/grps/default.json, and
#     its editor plugin loads that URL with fetch()
#     (`this.emoticons = yield this.handleData(this.kit.useConf().emoticons)`).
#     The blog hugo.toml does not override `emoticons`, so the default is the
#     URL actually requested. A fetch is governed by connect-src, so without
#     this origin the emoticon panel fails with "[Emoticons] Load Failed".
#
#   font-src + https://cdn.jsdelivr.net
#     The blog loads katex.min.css from jsdelivr, and that stylesheet pulls
#     the KaTeX webfonts from the same origin:
#     https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/fonts/KaTeX_*.woff2
#     A headless browser loading https://blog.hansendong.top/friends/ reports
#     one blocked font per face: "Loading the font ... violates the following
#     Content Security Policy directive: font-src 'self' data:".
#
#   script-src + https://cdnjs.cloudflare.com
#     highlight.min.js is loaded from cdnjs.cloudflare.com.
#
#   script-src + https://cdn.jsdelivr.net
#     katex, photoswipe and highlight.js bundles are loaded from jsdelivr.
#
#   style-src + https://cdn.jsdelivr.net
#     katex, highlight and photoswipe stylesheets are loaded from jsdelivr.
#
# Deliberately NOT asserted: cdnjs.cloudflare.com in connect-src. Nothing in
# either deployed tree fetches it: no fetch(), no XMLHttpRequest.open(), no
# WebSocket() targets cdnjs. It is only ever a <script src> source, and
# script subresource loads are governed by script-src, not connect-src.
# Asserting it there named a requirement the sites do not have, which is
# what buried the real ones (connect-src and font-src / jsdelivr).
#
# frame-ancestors 'none' and default-src 'self' are kept from the original
# verifier: they are the two directives whose absence actually weakens the
# policy.

# csp_escape_ere TEXT
#
# Escape TEXT so that the ERE in csp_has_origin matches it literally.
#
# Both halves of the pattern are escaped, and escaping only '.' was not
# enough:
#   - an unescaped '+' in an origin made 'a+b' match 'aab', so a policy
#     naming a different host satisfied a rule it did not satisfy;
#   - an unescaped '.' in a directive made 'connect.src' match
#     'connect-src', so a rule for one directive was satisfied by another.
#
# The character class is the set of ERE metacharacters: . [ ] \ ^ $ * + ?
# ( ) { } |. Everything else is literal and is left alone.
# The bracket expression puts the closing bracket first, where a bracket
# expression treats it as a literal, and the backslash is a literal
# backslash (POSIX bracket expressions do not use backslash as an escape).
csp_escape_ere() {
  printf '%s' "$1" | sed 's/[][\\.^$*+?(){}|]/\\&/g'
}

# csp_fold_policy <policy>
#
# Print <policy> with its CR and LF characters replaced by spaces. A CSP
# header value can be folded across lines, and browsers treat the fold as
# whitespace inside a source list, so the policy is folded to a single line
# before it is matched. Without this, grep works line by line and a
# directive whose source list continues on the next line is reported
# missing.
csp_fold_policy() {
  printf '%s' "$1" | tr '\n\r' '  '
}

# csp_has_origin <policy> <directive> <origin>
#
# True when <directive> in <policy> whitelists <origin>. Both ends are
# anchored on a CSP token boundary, so neither of these is accepted:
#   - prefix junk, e.g. `connect-src-extra https://cdn.jsdelivr.net;`
#     (an unknown directive; browsers ignore it)
#   - lookalike hosts, e.g. `https://cdn.jsdelivr.net.evil.example`
# All three valid source forms are accepted:
#   https://cdn.jsdelivr.net;          (origin)
#   https://cdn.jsdelivr.net/;         (path-prefix)
#   https://cdn.jsdelivr.net/foo.js;   (specific file)
# as is the space-separated multi-source form
# `connect-src https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;`.
#
# The lead-in group cannot cross a ';', so an origin that belongs to a
# DIFFERENT directive cannot satisfy this rule, and the directive itself
# has to start the policy or follow a ';', so a directive name inside
# another directive's source list is not a directive at all.
csp_has_origin() {
  local policy="${1-}"
  local directive="${2-}"
  local origin="${3-}"
  local escaped_directive escaped_origin

  # A directive or an origin that is EMPTY, or that carries whitespace, is
  # not one token. The pattern below anchors on token boundaries, so
  # matching such a value would compare against the wrong part of the
  # policy; it is rejected instead. The empty case is the dangerous one:
  # an empty origin makes the origin part of the pattern match the empty
  # string, so a directive with any value at all would satisfy the rule.
  case "$directive" in
    ''|*[[:space:]]*) return 1 ;;
  esac
  case "$origin" in
    ''|*[[:space:]]*) return 1 ;;
  esac

  policy="$(csp_fold_policy "$policy")"

  escaped_directive="$(csp_escape_ere "$directive")"
  escaped_origin="$(csp_escape_ere "$origin")"
  # The origin has to START a token, not merely appear inside one. Without
  # that, an origin sitting in the query string of another host satisfies the
  # rule: a policy value of
  #   script-src 'self' https://example.org/?u=https://cdn.jsdelivr.net
  # would pass the connect-src rule for https://cdn.jsdelivr.net.
  #
  # The DIRECTIVE has to start the policy or follow a ";", which is how a
  # CSP value is split into directives. Without that, a malformed policy
  # that omits a ';' lets a directive name inside another directive's
  # source list satisfy a rule:
  #   img-src data: script-src https://cdn.jsdelivr.net
  # would pass the script-src rule for https://cdn.jsdelivr.net, although a
  # browser reads the whole tail as img-src's source list and never sees a
  # script-src directive at all. Anchoring the directive makes the check
  # fail closed on that input.
  printf '%s' "$policy" \
    | grep -qiE "(^[[:space:]]*|;[[:space:]]*)${escaped_directive}[[:space:]]+([^;]*[[:space:]])?${escaped_origin}([[:space:];/]|$)"
}

# csp_rules
#
# The critical rules, one per line, as "<kind>|<directive>|<value>":
#
#   canonical  the directive must carry exactly this value
#   origin     the directive must whitelist this origin
#
# This list is the single source of truth. csp_missing_directives enforces
# it and csp_rule_count counts it, so the number the operator reads and the
# rules that actually run cannot drift apart: there is no second list to
# forget to update.
csp_rules() {
  cat <<'RULES'
canonical|frame-ancestors|'none'
canonical|default-src|'self'
origin|connect-src|https://cdn.jsdelivr.net
origin|font-src|https://cdn.jsdelivr.net
origin|script-src|https://cdnjs.cloudflare.com
origin|script-src|https://cdn.jsdelivr.net
origin|style-src|https://cdn.jsdelivr.net
RULES
}

# csp_missing_directives <policy>
#
# Prints one label per critical directive the policy is missing, one per
# line, and returns 1 when any is missing. Returns 0 and prints nothing
# when the policy satisfies every rule.
csp_missing_directives() {
  local policy="${1-}"
  local status=0
  local kind directive value

  policy="$(csp_fold_policy "$policy")"

  while IFS='|' read -r kind directive value; do
    case "$kind" in
      canonical)
        if ! printf '%s' "$policy" \
              | grep -qiE "(^[[:space:]]*|;[[:space:]]*)${directive}[[:space:]]+${value}[[:space:]]*(;|$)"; then
          printf '%s %s\n' "$directive" "$value"
          status=1
        fi
        ;;
      origin)
        if ! csp_has_origin "$policy" "$directive" "$value"; then
          printf '%s with %s\n' "$directive" "$value"
          status=1
        fi
        ;;
    esac
  done < <(csp_rules)

  return $status
}

# csp_rule_count
#
# How many critical rules are enforced. The success line in deploy.sh
# prints this number, so what the operator reads and what the module
# actually checks cannot drift apart: both come from csp_rules.
csp_rule_count() {
  csp_rules | grep -c .
}
