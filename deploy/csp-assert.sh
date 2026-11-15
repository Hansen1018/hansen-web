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
# The set is the ERE metacharacters: . [ ] backslash ^ $ * + ? ( ) { } |
csp_escape_ere() {
  printf '%s' "$1" | sed 's/[][\\.^$*+?(){}|]/\\&/g'
}

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

# csp_rule_count
#
# How many critical rules csp_missing_directives enforces. The success
# line in deploy.sh prints this number, so what the operator reads and what
# the module actually checks cannot drift apart.
#
# It is derived, not written down: an empty policy fails every rule, and
# csp_missing_directives prints one label per failed rule, so counting the
# labels counts the rules. A literal here would go stale the moment a rule
# was added or removed.
csp_rule_count() {
  local labels
  labels="$(csp_missing_directives '' || true)"
  printf '%s\n' "$labels" | grep -c . || true
}

#
# Prints one label per critical directive the policy is missing, one per
# line, and returns 1 when any is missing. Returns 0 and prints nothing when
# the policy satisfies every rule.
csp_missing_directives() {
  local policy="${1-}"
  local status=0

  if ! printf '%s' "$policy" \
        | grep -qiE "(^[[:space:]]*|;[[:space:]]*)frame-ancestors[[:space:]]+'none'[[:space:]]*(;|$)"; then
    printf "frame-ancestors 'none'\n"
    status=1
  fi
  if ! printf '%s' "$policy" \
        | grep -qiE "(^[[:space:]]*|;[[:space:]]*)default-src[[:space:]]+'self'[[:space:]]*(;|$)"; then
    printf "default-src 'self'\n"
    status=1
  fi
  if ! csp_has_origin "$policy" connect-src https://cdn.jsdelivr.net; then
    printf "connect-src with https://cdn.jsdelivr.net\n"
    status=1
  fi
  if ! csp_has_origin "$policy" font-src https://cdn.jsdelivr.net; then
    printf "font-src with https://cdn.jsdelivr.net\n"
    status=1
  fi
  if ! csp_has_origin "$policy" script-src https://cdnjs.cloudflare.com; then
    printf "script-src with https://cdnjs.cloudflare.com\n"
    status=1
  fi
  if ! csp_has_origin "$policy" script-src https://cdn.jsdelivr.net; then
    printf "script-src with https://cdn.jsdelivr.net\n"
    status=1
  fi
  if ! csp_has_origin "$policy" style-src https://cdn.jsdelivr.net; then
    printf "style-src with https://cdn.jsdelivr.net\n"
    status=1
  fi

  return $status
}
