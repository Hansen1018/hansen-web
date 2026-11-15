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
#     who owns blog/. That happens when the Next.js export starts shipping
#     its own blog/ directory (a future route, or an asset copied under
#     out/blog). Merging them, or letting one silently overwrite the
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
# This file DEFINES ONE FUNCTION and nothing else. It is sourced by
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
# The confirmation line below ("blog-handover: ok ...") is the ONLY thing
# this function writes to stdout, and it goes there on purpose: the caller
# captures stdout and checks that the marker is in it, which is how it
# knows the hand-over actually ran on the host.

stage_blog_into_staging() {
  bh_live_root=${1-}
  bh_staging_root=${2-}

  # An empty root is not a root. Without this, a lost argument would test
  # "/blog" (absolute) or "blog" (relative to the current directory) and
  # quietly copy the wrong tree.
  if [ -z "$bh_live_root" ] || [ -z "$bh_staging_root" ]; then
    echo "error: stage_blog_into_staging needs LIVE_ROOT and STAGING_ROOT" >&2
    return 1
  fi

  # This module is a standalone entry point, so it does not rely on the
  # caller having validated the paths. "/" and a ".." component are
  # refused here as well as in deploy.sh.
  case "$bh_live_root" in
    /)
      echo "error: refusing to use / as the live web root" >&2
      return 1
      ;;
  esac
  case "$bh_staging_root" in
    /)
      echo "error: refusing to use / as the staging root" >&2
      return 1
      ;;
  esac
  case "/$bh_live_root/" in
    */../*)
      echo "error: the live web root must not contain a '..' component ($bh_live_root)" >&2
      return 1
      ;;
  esac
  case "/$bh_staging_root/" in
    */../*)
      echo "error: the staging root must not contain a '..' component ($bh_staging_root)" >&2
      return 1
      ;;
  esac

  if [ ! -d "$bh_staging_root" ]; then
    echo "error: the staging root $bh_staging_root does not exist or is not a directory" >&2
    return 1
  fi

  if [ ! -d "$bh_live_root/blog" ]; then
    # A blog that exists but is not a directory cannot be carried over, and
    # treating it as "no blog here" would drop it at the swap, which is the
    # 404 this script exists to prevent.
    if [ -e "$bh_live_root/blog" ] || [ -L "$bh_live_root/blog" ]; then
      echo "error: $bh_live_root/blog exists but is not a directory; nothing was carried over" >&2
      return 1
    fi
    echo "blog-handover: ok (no blog/ in the live web root)"
    return 0
  fi

  # -e misses a dangling symlink, and a link in the staging tree would make
  # the copy below write THROUGH it, outside the web root. -L covers every
  # entry that exists as a link, broken or not.
  if [ -e "$bh_staging_root/blog" ] || [ -L "$bh_staging_root/blog" ]; then
    echo "error: $bh_staging_root/blog and $bh_live_root/blog both exist." >&2
    echo "       The live web root and this build disagree about who owns blog/." >&2
    echo "       Merging them, or letting one silently overwrite the other, would" >&2
    echo "       publish a tree nobody wrote. Resolve it and deploy again." >&2
    return 1
  fi

  # The remote host's sh has no "set -e", so every step is checked here.
  # The underlying error is kept and printed: "permission denied" and "no
  # space left on device" are what the operator needs, and swallowing them
  # leaves only a generic message to work with.
  bh_mkdir_err="$(mkdir -p "$bh_staging_root/blog" 2>&1)" || {
    echo "error: could not create $bh_staging_root/blog" >&2
    if [ -n "$bh_mkdir_err" ]; then
      echo "       $bh_mkdir_err" >&2
    fi
    return 1
  }

  bh_cp_err="$(cp -Rp "$bh_live_root/blog/." "$bh_staging_root/blog/" 2>&1)" || {
    echo "error: could not copy $bh_live_root/blog into $bh_staging_root/blog" >&2
    if [ -n "$bh_cp_err" ]; then
      echo "       $bh_cp_err" >&2
    fi
    # Leave no half-written tree behind: the next run would otherwise hit
    # the "both exist" refusal above on this run's leftovers and blame the
    # live web root for them. If the cleanup itself fails, say so, because
    # the next run WILL hit that refusal and the operator has to know why.
    if ! rm -rf "$bh_staging_root/blog"; then
      echo "warning: could not remove the partial $bh_staging_root/blog;" >&2
      echo "         remove it before the next deploy" >&2
    fi
    return 1
  }

  echo "blog-handover: ok (carried $bh_live_root/blog)"
  return 0
}
