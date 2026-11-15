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

# csp_rule_field_is_valid <field>
#
# A rule field is ONE token: not empty, and carrying no whitespace. A
# field with whitespace in it names something that cannot be compared
# with a policy at a token boundary, so it is refused here rather than
# handed to a matcher.
csp_rule_field_is_valid() {
  case "${1-}" in
    '') return 1 ;;
    *[[:space:]]*) return 1 ;;
  esac
  return 0
}

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
  # An empty TEXT has no escaped form, and an empty pattern in an ERE
  # matches EVERY text, so handing one to a matcher would make a rule
  # pass for any policy at all. The same is true when the "sed" itself
  # fails: the result would be empty as well. Both cases are refused
  # here, and the non-zero status tells the caller that the rule cannot
  # be evaluated, so the rule is reported as NOT satisfied.
  if [ -z "${1-}" ]; then
    return 1
  fi
  local csp_ee_out
  csp_ee_out="$(printf '%s' "$1" | sed 's/[][\\.^$*+?(){}|]/\\&/g')" || return 1
  if [ -z "$csp_ee_out" ]; then
    return 1
  fi
  printf '%s' "$csp_ee_out"
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
  policy="$(csp_fold_policy "$policy")"
  csp_has_origin_folded "$policy" "${2-}" "${3-}"
}

# csp_has_origin_folded <folded policy> <directive> <origin>
#
# The matcher on a policy that is ALREADY folded.
#
# csp_has_origin folds the policy and calls this. csp_missing_directives
# folds the policy ONCE and calls this directly, so a policy is not folded
# again for every rule that is checked against it.
csp_has_origin_folded() {
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
  # The same rule the rule list is held to, checked with the same
  # helper, so the two copies of the "one token" rule cannot drift
  # apart: a directive or an origin that is empty, or that carries
  # whitespace, is not one token.
  if ! csp_rule_field_is_valid "$directive" || ! csp_rule_field_is_valid "$origin"; then
    return 1
  fi

  # The escape has to produce something. An empty pattern matches every
  # text, so a failed escape would make this rule pass for any policy at
  # all; the rule is reported as NOT satisfied instead, which is the
  # direction that fails closed.
  if ! escaped_directive="$(csp_escape_ere "$directive")" ||
     ! escaped_origin="$(csp_escape_ere "$origin")"; then
    return 1
  fi
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
# The two kinds differ on purpose. A canonical rule asks whether the
# directive carries that value and nothing else, so "default-src 'self'
# https://x" is reported as missing: the extra source widens the policy
# and the rule is about the policy being exactly what was measured. An origin
# rule asks whether the directive whitelists one origin, so the other
# sources beside it are allowed.
#
# This list is the single source of truth. It is parsed in ONE place,
# csp_rule_list, which holds a rule to a known kind and to one token per
# field before the rule is handed on: a rule that cannot be compared with
# a policy is dropped with a "!!" label instead of being counted as a
# rule that ran. csp_missing_directives enforces the parsed list and
# csp_rule_count counts it, so the number the operator reads and the rules
# that actually run cannot drift apart: there is no second list to forget
# to update.
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

# csp_rule_list
#
# Print the rules that run, one per line, as "<kind>|<directive>|<value>".
#
# This is the ONE place the rule list is parsed. Both the enforcement below
# and csp_rule_count read this output, so the number the operator reads and
# the rules that actually run cannot drift apart.
#
# A rule that cannot run is printed as "!!<reason>", so the caller sees it on
# stdout instead of silently checking fewer rules than it says.
csp_rule_list() {
  local line kind rest directive value
  local rules
  # The rules are read into a variable first, so a failed read is
  # VISIBLE: the caller sees a "!!" label like any other problem with
  # the list, instead of an empty list that reads as "there are no
  # rules". A rule list that could not be read must not look like a
  # rule list that was checked and found nothing.
  if ! rules="$(csp_rules)"; then
    printf '!!could not read the CSP rule list\n'
    return 1
  fi
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*)
        # A blank line and a comment are not rules.
        continue
        ;;
    esac
    kind="${line%%|*}"
    rest="${line#*|}"
    directive="${rest%%|*}"
    value="${rest#*|}"
    case "$rest" in
      *'|'*) : ;;
      *)
        # A rule needs three fields: kind, directive and value.
        printf '!!malformed rule: %s\n' "$line"
        continue
        ;;
    esac
    case "$value" in
      *'|'*)
        # The fields are split on "|", so a value may not contain one.
        printf '!!malformed rule: %s\n' "$line"
        continue
        ;;
    esac
    case "$kind" in
      canonical|origin) ;;
      *)
        # An unknown kind is a typo, and a typo must not turn into a rule
        # that is silently never enforced.
        printf '!!unknown rule kind: %s\n' "$kind"
        continue
        ;;
    esac
    # A directive and a value are each ONE token: a rule names one
    # directive and one source, and a field that carries whitespace
    # names something that cannot be compared with a policy at a token
    # boundary. Both kinds are held to this rule HERE, at the parse
    # point, so a rule that cannot be compared with a policy never
    # reaches a matcher and never counts as a rule that ran.
    if [ -z "$directive" ] || [ -z "$value" ] ||
       ! csp_rule_field_is_valid "$directive" ||
       ! csp_rule_field_is_valid "$value"; then
      # A rule with a missing field, or with a field that is not one
      # token, enforces nothing, so it is not a rule.
      printf '!!malformed rule: %s\n' "$line"
      continue
    fi
    printf '%s|%s|%s\n' "$kind" "$directive" "$value"
  done < <(printf '%s\n' "$rules")
}

csp_missing_directives() {
  local policy="${1-}"
  local status=0
  local rule_count=0
  local broken_rules=0
  local kind directive value
  local canonical_directive canonical_value
  local line rest

  policy="$(csp_fold_policy "$policy")"

  # The rules come from csp_rule_list, the same list csp_rule_count counts,
  # so the number the operator reads and the rules that run are the same
  # set, field for field.
  while IFS= read -r line; do
    # A problem with the rule list is reported as a LABEL on stdout: the
    # caller reads stdout to decide what to report, so a rule that cannot
    # run must not be invisible there.
    case "$line" in
      '!!'*)
        # The marker is KEPT on stdout, so the caller can tell a fault in
        # the rule list from a gap in the served policy: a rule list that
        # cannot be parsed is a fault in this repository, not something
        # the served policy is missing.
        printf '%s\n' "$line"
        broken_rules=$(( ${broken_rules:-0} + 1 ))
        status=1
        continue
        ;;
    esac
    kind="${line%%|*}"
    rest="${line#*|}"
    directive="${rest%%|*}"
    value="${rest#*|}"
    case "$rest" in
      *'|'*)
        : ;;
      *)
        # A line that is neither a rule nor a "!!" label is a rule list
        # that did not come out whole. It is refused rather than parsed
        # as a rule with the wrong fields, which would enforce nothing
        # while being counted as a rule that ran.
        printf "!!malformed rule: %s\n" "$line"
        status=1
        continue
        ;;
    esac
    case "$kind" in
      canonical|origin)
        ;;
      *)
        printf "!!unknown rule kind: %s\n" "$kind"
        status=1
        continue
        ;;
    esac
    if [ -z "$value" ]; then
      printf "!!malformed rule: %s\n" "$line"
      status=1
      continue
    fi
    # The count is the number of rules in the PARSED list, which is what
    # csp_rule_count reports: both read the same list, so the number the
    # operator reads and the number of rules this loop walked cannot drift
    # apart. A rule the loop refuses to evaluate (a failed escape) is
    # still a rule of the list, so it stays in the count and is reported
    # with a "!!" label of its own.
    rule_count=$((rule_count + 1))
    case "$kind" in
      canonical)
        # The directive and the value are escaped like the origin below, so
        # a rule written with a '.' or a '+' cannot match something else.
        # The escape has to produce something, exactly as in the origin
        # branch below: an empty pattern matches every text, so a failed
        # escape would make this rule pass for any policy at all. The
        # rule is reported as a fault in the rule list instead.
        if ! canonical_directive="$(csp_escape_ere "$directive")" ||
           ! canonical_value="$(csp_escape_ere "$value")"; then
          printf '!!the rule could not be evaluated: %s\n' "$line"
          status=1
          continue
        fi
        if ! printf '%s' "$policy" \
              | grep -qiE "(^[[:space:]]*|;[[:space:]]*)${canonical_directive}[[:space:]]+${canonical_value}[[:space:]]*(;|$)"; then
          printf '%s %s\n' "$directive" "$value"
          status=1
        fi
        ;;
      origin)
        # The policy is already folded above, so the matcher that
        # takes a folded policy is used here: folding it again for
        # every rule is work that buys nothing.
        if ! csp_has_origin_folded "$policy" "$directive" "$value"; then
          printf '%s with %s\n' "$directive" "$value"
          status=1
        fi
        ;;
    esac
  done < <(csp_rule_list)

  # An empty rule list would report every policy as verified while no rule
  # ran at all, so it fails instead. The label goes to stdout as well,
  # because the caller reads stdout to decide what to report.
  if [ "$rule_count" -eq 0 ]; then
    # A rule list that is NOT empty but cannot be read is a different
    # fault: the rules ARE defined, they just cannot run. Saying "no
    # critical rules are defined" there would blame an empty list for a
    # broken one, so the two are reported apart.
    if [ "${broken_rules:-0}" -gt 0 ]; then
      echo "!!no critical rule could be enforced"
      echo "the CSP rule list is broken; refusing to report the policy as verified" >&2
    else
      echo "!!no critical rules are defined"
      echo "the CSP rule list is empty; refusing to report the policy as verified" >&2
    fi
    status=1
  fi

  return $status
}

# csp_rule_count
#
# How many critical rules are enforced. The success line in deploy.sh
# prints this number, so what the operator reads and what the module
# actually checks cannot drift apart: both come from csp_rules.
csp_rule_count() {
  # The count is the number of rules that run, and it skips the blank lines
  # the enforcement loop skips. "grep -c" exits 1 when it counts nothing,
  # so the exit status is ignored: the number is a display, and an empty
  # rule list is caught where it matters, in csp_missing_directives.
  # The number of rules that RUN: the same list the enforcement
  # consumes, parsed by the same function, so the two cannot drift
  # apart. A "!!" line is a problem with the rule list, not a rule,
  # so it is not counted.
  csp_rule_list | grep -c -E '^(canonical|origin)[|]' || true
}
