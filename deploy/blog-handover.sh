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
#   - if the staging directory already has a blog/, the two trees disagree
#     about who owns blog/. That happens when the Next.js export starts
#     shipping its own blog/ directory (a future route, or an asset copied
#     under out/blog). Merging them, or letting one silently overwrite the
#     other, would publish a tree nobody wrote, so the deploy stops and
#     says so;
#   - the CONTENTS of the source are copied ("src/."), so the tree is never
#     merged with another one and never nested one level deeper as
#     blog/blog;
#   - the source may be a symlink to a directory: its contents are copied
#     and the link itself is not carried into the web root.
#
# Two ways to use it:
#   . deploy/blog-handover.sh
#     -> defines stage_blog_into_staging LIVE_ROOT STAGING_ROOT
#   BLOG_HANDOVER_RUN=1 sh -s -- LIVE_ROOT STAGING_ROOT < deploy/blog-handover.sh
#     -> runs it directly, which is how the remote branch of deploy.sh uses
#        it: the same implementation is shipped to the host over stdin, so
#        the local and remote paths cannot drift apart.
#
# POSIX sh, not bash: the remote branch runs it with "sh -s".

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

  if [ ! -d "$bh_live_root/blog" ]; then
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

  mkdir -p "$bh_staging_root/blog"
  cp -a "$bh_live_root/blog/." "$bh_staging_root/blog/"
}

# The function returns rather than exits, so a caller that sourced this file
# keeps its own exit semantics; the remote entry point turns the failure into
# an exit status.
if [ "${BLOG_HANDOVER_RUN:-}" = "1" ]; then
  stage_blog_into_staging "${1-}" "${2-}" || exit 1
fi
