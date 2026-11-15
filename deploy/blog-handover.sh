#!/bin/sh
# Carry the live web root's blog/ directory into the staging directory
# before an atomic swap, so the swap does not drop files that this
# repository does not own.
#
# The Hugo blog repo deploys blog/feed.json into the same web root (its
# deploy.sh sets WEB_DIR=/var/www/hansen-web). The Next.js export has no
# blog/ directory, so without this hand-over the swap deletes it and
# https://hansendong.top/blog/feed.json returns 404.
#
# The hand-over is deterministic, and it refuses rather than guesses:
#   - if the staging tree already has a blog/, the two trees disagree about
#     who owns blog/. Merging them, or letting one silently overwrite the
#     other, would publish a tree nobody wrote, so the deploy stops;
#   - the CONTENTS of the source are copied ("src/."), so the tree is
#     never merged with another one and never nested one level deeper as
#     blog/blog;
#   - the source may be a symlink to a directory: its contents are copied
#     and the link itself is not carried into the web root;
#   - a source that is not a directory at all is an error, not a silent
#     no-op: returning 0 there would let the swap drop the blog without a
#     word, which is the 404 this script exists to prevent;
#   - a failed copy leaves no half-written tree behind, so the next run is
#     not blocked by this run's leftovers.
#
# The staging root has to exist already. Creating it here would let a
# typo in the path produce a staging tree holding nothing but blog/, and
# the swap would then replace the whole site with it.
#
# THE PATH RULES LIVE HERE, and deploy.sh calls these same functions, so
# there is one implementation of what a safe path is. Two validators that
# disagree about what is safe are worse than one.
#
# This file DEFINES FUNCTIONS and nothing else. It is sourced by
# deploy.sh for the local branch, and shipped to the host over stdin for
# the remote branch, so the two paths cannot drift apart. The remote
# branch appends the call to this file before piping it to "sh -s":
#
#   stage_blog_into_staging "$1" "$2" || exit 1
#
# There is deliberately no environment-variable trigger here. An earlier
# version took over the shell when BLOG_HANDOVER_RUN=1 was set, so a
# caller that both set the variable and sourced this file had its shell
# taken over and exited. The call is appended by the caller instead, so
# sourcing this file can never exit anything.
#
# POSIX sh, not bash: the remote branch runs it with "sh -s". The copy uses
# "cp -Rp" rather than "cp -a": -a is a GNU extension, and the remote
# host's cp is exactly the one whose flavour is unknown.
#
# The confirmation line below is the ONLY thing stage_blog_into_staging
# writes to stdout, and it goes there on purpose: the caller captures
# stdout alone and checks the marker in it, which is how it knows the
# hand-over actually ran. Every diagnostic goes to stderr, so a refusal can
# never be mistaken for the confirmation.

# bh_trim_path PATH
#
# Print PATH with its trailing slashes trimmed.
#
# The trailing slash is trimmed because the staging path is derived from
# it: "/var/www/site/" would derive "/var/www/site/.tmp", a directory
# INSIDE the live web root, instead of "/var/www/site.tmp", its sibling.
bh_trim_path() (
  # The body is a subshell, so the working variable cannot leak into the
  # caller's shell. POSIX sh has no "local", and this file is sourced into
  # deploy.sh, where a stray variable is one rename away from a bug.
  bh_tp_path="$1"
  while [ "${bh_tp_path%/}" != "$bh_tp_path" ] && [ "$bh_tp_path" != "/" ]; do
    bh_tp_path="${bh_tp_path%/}"
  done
  printf '%s\n' "$bh_tp_path"
)

# bh_fold_path PATH
#
# Print PATH folded: its "." components dropped and its ".." components
# resolved against the components before them, the way the kernel resolves
# them.
#
# The body is a subshell, so its working variables never reach the shell
# that sources this file, and the folded path is the ONLY thing it prints.
# The helper used to leave five variables in the caller's shell and to
# print its result as well, and every caller had to redirect the output and
# then read a global: one contract, one value, nothing left behind.
#
# A relative path that climbs above the directory it was given relative to
# prints "..", so the caller can see it. A path that resolves to the
# current directory prints ".".
bh_fold_path() (
  bh_fp_in="$1"
  bh_fp_out=""
  bh_fp_depth=0
  bh_fp_escape=0
  case "$bh_fp_in" in
    /*) bh_fp_absolute=1 ;;
    *) bh_fp_absolute=0 ;;
  esac
  while [ -n "$bh_fp_in" ]; do
    case "$bh_fp_in" in
      */*) bh_fp_comp="${bh_fp_in%%/*}"; bh_fp_in="${bh_fp_in#*/}" ;;
      *) bh_fp_comp="$bh_fp_in"; bh_fp_in="" ;;
    esac
    case "$bh_fp_comp" in
      ''|'.') ;;
      '..')
        if [ "$bh_fp_depth" -gt 0 ]; then
          bh_fp_depth=$((bh_fp_depth - 1))
          case "$bh_fp_out" in
            */*) bh_fp_out="${bh_fp_out%/*}" ;;
            *) bh_fp_out="" ;;
          esac
        elif [ "$bh_fp_absolute" -eq 0 ]; then
          # A relative path that climbs above its base cannot be resolved
          # any further: the kernel refuses it, and "rm -rf" on it would
          # delete a parent the operator never named.
          bh_fp_escape=1
        fi
        ;;
      *)
        bh_fp_depth=$((bh_fp_depth + 1))
        bh_fp_out="$bh_fp_out/$bh_fp_comp"
        ;;
    esac
  done
  if [ "$bh_fp_escape" -eq 1 ]; then
    printf '%s\n' ".."
    # The body is a subshell, and "return" inside one is not portable
    # (dash: "can only return from a function or sourced script"), so the
    # subshell is left with the status the caller expects.
    exit 0
  fi
  if [ "$bh_fp_absolute" -eq 1 ]; then
    # ".." at the root stays at the root, the way the kernel resolves it.
    printf '%s\n' "/${bh_fp_out#/}"
  else
    bh_fp_out="${bh_fp_out#/}"
    [ -n "$bh_fp_out" ] || bh_fp_out="."
    printf '%s\n' "$bh_fp_out"
  fi
)

# bh_path_is_safe PATH LABEL
#
# Refuse a path that "rm -rf" would delete something else with.
#
# The check is made on the FOLDED path, so it sees what the kernel will
# actually resolve:
#   - an empty path;
#   - a path that resolves to the root ("/", "//", "/.", "/./",
#     "/a/.."), because "rm -rf" on it deletes the filesystem root;
#   - a relative path that resolves to the current directory (".",
#     "a/..") or climbs above it ("..", "../x"): "rm -rf .." deletes a
#     parent the operator never named;
#   - an absolute path with a ".." component ("/var/www/site/../etc"),
#     which resolves to a different directory than it appears to name;
#   - a path that starts with "-", which "rm -rf" would read as an option.
#
# A relative path that stays INSIDE the current directory is allowed:
# "./site", "out/../site" and "site/" all name a directory the operator
# asked for, and a local deploy never leaves this host.
#
# The body is a subshell, so the folded path it computes stays here.
bh_path_is_safe() (
  case "$1" in
    "")
      echo "✗ $2 must not be empty" >&2
      exit 1
      ;;
  esac
  # A newline in the path would break the confirmation protocol: the marker
  # is one line, and a path with a newline in it spans two.
  bh_nl='
'
  case "$1" in
    *"$bh_nl"*)
      echo "✗ $2 must not contain a newline (got: $1)" >&2
      exit 1
      ;;
  esac

  bh_folded="$(bh_fold_path "$1")"

  # The check is on the FOLDED path, so "./-rf" is judged as "-rf": it
  # reaches "rm -rf" as an OPTION, not as a path.
  case "$bh_folded" in
    -*)
      echo "✗ $2 must not start with '-' (got: $1)" >&2
      exit 1
      ;;
  esac

  case "$bh_folded" in
    "..")
      echo "✗ $2 must not climb above the current directory (got: $1)" >&2
      exit 1
      ;;
    ".")
      echo "✗ $2 must not be the current directory (got: $1)" >&2
      exit 1
      ;;
    "/")
      echo "✗ $2 must not be the root directory (got: $1)" >&2
      exit 1
      ;;
  esac

  case "$1" in
    /*)
      case "/$1/" in
        */../*)
          echo "✗ $2 must not contain a '..' component (got: $1)" >&2
          exit 1
          ;;
      esac
      ;;
  esac
  exit 0
)

# require_no_parent_refs PATH LABEL
#
# Refuse a path with a ".." component.
#
# This is for the REMOTE branch only. The path is handed to another host,
# where "a/../b" is resolved against that host's tree and a symlink
# anywhere along the way can make it resolve somewhere else entirely.
# Locally the same path names a directory the operator can see.
require_no_parent_refs() {
  case "/$1/" in
    */../*)
      echo "✗ $2 must not contain a '..' component in remote mode (got: $1)" >&2
      return 1
      ;;
  esac
  return 0
}

# bh_marker_ok LIVE_ROOT
#
# Print the confirmation the caller checks. The caller compares what the
# hand-over wrote against this same function, so the wording lives here
# only: a reworded message cannot silently turn a successful hand-over
# into a failed deploy.
bh_marker_ok() {
  printf 'blog-handover: ok (carried %s/blog)\n' "$1"
}

# bh_marker_noblog
#
# Print the confirmation for a live web root that has no blog/ to carry
# over. That is a different fact from a completed hand-over, so it is a
# different marker.
bh_marker_noblog() {
  printf 'blog-handover: no-blog (no blog/ in %s)\n' "$1"
}

# bh_canonical_path PATH
#
# Print PATH with the symlinks in it resolved, when it names a directory
# that exists. "cd -P" and "pwd -P" are POSIX; "readlink -f" is not, and
# the remote host's tools are the ones we cannot assume.
bh_canonical_path() (
  # The body is a subshell, so the working variable cannot leak into the
  # shell that sources this file.
  bh_cp_real="$(cd -P "$1" 2>/dev/null && pwd -P)" || bh_cp_real=""
  if [ -n "$bh_cp_real" ]; then
    printf '%s\n' "$bh_cp_real"
  else
    printf '%s\n' "$1"
  fi
)

# stage_blog_into_staging LIVE_ROOT STAGING_ROOT
#
# Carry LIVE_ROOT/blog/ into STAGING_ROOT/blog/.
#
# The two roots must not be the same directory, must not contain one
# another, and must not be inside one another: the copy writes into the
# staging root and the cleanup below deletes from it, so a staging root
# that holds the live tree would delete the live blog/ while copying it.
# The body is a subshell, so the variables it computes (the roots, the
# folded paths, the error strings) stay inside it and do not leak into
# the shell that sourced this file. "return" inside a subshell body is not
# portable in dash ("can only return from a function or sourced script"),
# so the body leaves with "exit" and the caller sees the same status.
stage_blog_into_staging() (
  bh_live_root=${1-}
  bh_staging_root=${2-}

  if [ -z "$bh_live_root" ] || [ -z "$bh_staging_root" ]; then
    echo "error: stage_blog_into_staging needs LIVE_ROOT and STAGING_ROOT" >&2
    exit 1
  fi

  bh_live_root="$(bh_trim_path "$bh_live_root")"
  bh_staging_root="$(bh_trim_path "$bh_staging_root")"

  # The same rules deploy.sh applies to REMOTE_DIR, from the same file, so
  # the two cannot drift apart: a path that "rm -rf" would delete something
  # else with is refused here too.
  bh_path_is_safe "$bh_live_root" 'the live web root' || exit 1
  bh_path_is_safe "$bh_staging_root" 'the staging root' || exit 1

  # The comparisons are made on the FOLDED paths and on the paths with
  # their symlinks resolved. Comparing the raw strings would miss two
  # roots that name the same directory through different spellings, and
  # that is the case where the copy and the cleanup destroy the live tree.
  bh_live_folded="$(bh_fold_path "$bh_live_root")"
  bh_staging_folded="$(bh_fold_path "$bh_staging_root")"
  bh_live_real="$(bh_canonical_path "$bh_live_folded")"
  bh_staging_real="$(bh_canonical_path "$bh_staging_folded")"
  # The copy, the inspection and the cleanup work on the FOLDED roots: the
  # checks judged those, so those are what is operated on.
  bh_live_dir="$bh_live_folded"
  bh_staging_dir="$bh_staging_folded"

  if [ "$bh_live_real" = "$bh_staging_real" ]; then
    echo "error: the staging root and the live web root are the same directory ($bh_live_real)" >&2
    exit 1
  fi
  case "$bh_live_real/" in
    "$bh_staging_real/"*)
      echo "error: the staging root ($bh_staging_real) contains the live web root ($bh_live_real)" >&2
      exit 1
      ;;
  esac
  case "$bh_staging_real/" in
    "$bh_live_real/"*)
      echo "error: the staging root ($bh_staging_real) is inside the live web root ($bh_live_real)" >&2
      exit 1
      ;;
  esac

  if [ ! -d "$bh_staging_dir" ]; then
    echo "error: the staging root $bh_staging_dir does not exist or is not a directory" >&2
    exit 1
  fi

  if [ ! -d "$bh_live_dir/blog" ]; then
    # A blog that exists but is not a directory cannot be carried over, and
    # treating it as "no blog here" would drop it at the swap, which is the
    # 404 this script exists to prevent.
    if [ -L "$bh_live_dir/blog" ]; then
      # A link that does not resolve to a directory is not the same thing
      # as a plain file, and saying so tells the operator which one it is.
      echo "error: $bh_live_dir/blog is a symlink that does not resolve to a directory;" >&2
      echo "       nothing was carried over" >&2
      exit 1
    fi
    if [ -e "$bh_live_dir/blog" ]; then
      echo "error: $bh_live_dir/blog exists but is not a directory; nothing was carried over" >&2
      exit 1
    fi
    bh_marker_noblog "$bh_live_root"
    exit 0
  fi

  # A FIFO or a device node would make cp block or fail, and the failure
  # would surface only after cp has already waited. They are refused
  # instead, so the deploy stops immediately.
  # "head -n 1" is deliberately not used here: it exits as soon as it
  # has a line, "find" then dies of SIGPIPE, and under "set -o pipefail"
  # that fails the whole pipeline and aborts the deploy before the message
  # below is printed. "sed -n 1p" reads the whole stream, so "find"
  # finishes normally, and find's own error stays visible.
  # find runs on its own, so the status checked here is find's and not the
  # status of the last command in a pipeline: a tree it cannot read is
  # refused instead of being reported as inspected. Its stderr is left
  # visible.
  bh_special_all="$(find "$bh_live_dir/blog" ! -type f ! -type d ! -type l -print)" || {
    echo "error: could not inspect $bh_live_dir/blog for non-regular files" >&2
    exit 1
  }
  bh_special="$(printf '%s
' "$bh_special_all" | sed -n '1p')"
  # The detection uses the whole list, so a filename that contains a
  # newline cannot hide the entry that has to be reported. The message
  # below names the first line of it.
  if [ -n "$bh_special_all" ]; then
    echo "error: $bh_special is not a regular file, directory or symlink; the hand-over copies only those" >&2
    exit 1
  fi

  # -e misses a dangling symlink, and a link in the staging tree would make
  # the copy below write THROUGH it, outside the web root. -L covers every
  # entry that exists as a link, broken or not.
  if [ -e "$bh_staging_dir/blog" ] || [ -L "$bh_staging_dir/blog" ]; then
    echo "error: $bh_staging_dir/blog and $bh_live_dir/blog both exist." >&2
    echo "       The live web root and this build disagree about who owns blog/." >&2
    echo "       Merging them, or letting one silently overwrite the other, would" >&2
    echo "       publish a tree nobody wrote. Resolve it and deploy again." >&2
    exit 1
  fi

  # The remote host's sh has no "set -e", so every step is checked here.
  # The underlying error is kept and printed: "permission denied" and "no
  # space left on device" are what the operator needs, and swallowing them
  # leaves only a generic message to work with.
  bh_mkdir_err="$(mkdir -p "$bh_staging_dir/blog" 2>&1)" || {
    echo "error: could not create $bh_staging_dir/blog" >&2
    if [ -n "$bh_mkdir_err" ]; then
      echo "       $bh_mkdir_err" >&2
    fi
    exit 1
  }

  bh_cp_err="$(cp -Rp "$bh_live_dir/blog/." "$bh_staging_dir/blog/" 2>&1)" || {
    echo "error: could not copy $bh_live_dir/blog into $bh_staging_dir/blog" >&2
    if [ -n "$bh_cp_err" ]; then
      echo "       $bh_cp_err" >&2
    fi
    # Leave no half-written tree behind: the next run would otherwise hit
    # the "both exist" refusal above on this run's leftovers and blame the
    # live web root for them. If the cleanup itself fails, say so, because
    # the next run WILL hit that refusal and the operator has to know why.
    if ! rm -rf "$bh_staging_dir/blog"; then
      echo "warning: could not remove the partial $bh_staging_dir/blog;" >&2
      echo "         remove it before the next deploy" >&2
    fi
    exit 1
  }

  bh_marker_ok "$bh_live_root"
  exit 0
)
