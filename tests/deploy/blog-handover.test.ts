import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest runs with the project root as its cwd, which is where deploy.sh and
// deploy/ live.
const repoRoot = process.cwd()
const modulePath = join(repoRoot, 'deploy', 'blog-handover.sh')
const deployShPath = join(repoRoot, 'deploy.sh')

type Result = { status: number; stdout: string; stderr: string }

// Run the hand-over the way deploy.sh does: the module is sourced and the
// function is called with the live root and the staging root.
function handOver(liveRoot: string, stagingRoot: string): Result {
  const script = '. "$1"; stage_blog_into_staging "$2" "$3"'
  try {
    const stdout = execFileSync('sh', ['-c', script, 'handover-test', modulePath, liveRoot, stagingRoot], {
      encoding: 'utf8',
    })
    return { status: 0, stdout, stderr: '' }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
  }
}

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'blog-handover-'))
}

function writeFile(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

describe('the blog hand-over', () => {
  it('prints exactly the marker deploy.sh expects', () => {
    // deploy.sh compares the hand-over's stdout against a marker it
    // builds locally, with an exact string comparison. If the module's
    // output and that marker drift apart, the deploy refuses - so the
    // two are pinned together here, by running the real hand-over and
    // comparing its stdout with the marker the module produces for the
    // same root.
    const live = scratch()
    const staging = scratch()
    mkdirSync(join(live, 'blog'), { recursive: true })
    writeFileSync(join(live, 'blog', 'post.md'), 'post')
    const out = execFileSync(
      'sh',
      ['-c', '. "$1"; stage_blog_into_staging "$2" "$3"', 'marker-test', modulePath, live, staging],
      { encoding: 'utf8' },
    )
    const expected = execFileSync(
      'sh',
      ['-c', '. "$1"; bh_marker_ok "$2"', 'marker-test', modulePath, live],
      { encoding: 'utf8' },
    )
    expect(out.trim()).toBe(expected.trim())
  })

  it('carries the live blog into the staging directory, byte for byte', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), '{"version":"https://jsonfeed.org/version/1.1"}')
    writeFile(join(live, 'blog', 'index.html'), '<h1>blog</h1>')
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).toBe(0)
    expect(readFileSync(join(staging, 'blog', 'feed.json'), 'utf8')).toBe(
      '{"version":"https://jsonfeed.org/version/1.1"}',
    )
    expect(readFileSync(join(staging, 'blog', 'index.html'), 'utf8')).toBe('<h1>blog</h1>')
  })

  it('refuses instead of merging two trees that both claim blog/', () => {
    // This is the case the review found: the export starts shipping its own
    // blog/ directory, and the hand-over merges it with the Hugo blog, so the
    // published tree is one nobody wrote.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'hugo')
    writeFile(join(staging, 'blog', 'page.html'), 'export')

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('blog/')
    // Nothing was written: the export's file is still the only one there.
    expect(existsSync(join(staging, 'blog', 'feed.json'))).toBe(false)
    expect(readFileSync(join(staging, 'blog', 'page.html'), 'utf8')).toBe('export')
  })

  it('never nests the blog one level deeper as blog/blog', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'hugo')
    mkdirSync(join(staging, 'blog'), { recursive: true })

    handOver(live, staging)
    expect(existsSync(join(staging, 'blog', 'blog'))).toBe(false)
  })

  it('copies the contents of a symlinked blog instead of the link', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    const target = join(dir, 'elsewhere')
    writeFile(join(target, 'feed.json'), 'hugo')
    mkdirSync(live, { recursive: true })
    symlinkSync(target, join(live, 'blog'))
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).toBe(0)
    expect(readFileSync(join(staging, 'blog', 'feed.json'), 'utf8')).toBe('hugo')
  })

  it('does nothing when the live web root has no blog directory', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    mkdirSync(live, { recursive: true })
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).toBe(0)
    expect(existsSync(join(staging, 'blog'))).toBe(false)
  })
})

describe('deploy.sh wires the shared hand-over into both branches', () => {
  const src = readFileSync(deployShPath, 'utf8')

  it('runs the hand-over in the local branch', () => {
    expect(src).toContain('stage_blog_into_staging "$REMOTE_DIR" "$REMOTE_DIR.tmp"')
  })

  it('runs the same file in the remote branch, over stdin', () => {
    // The module defines the function and nothing else; the caller appends
    // the call. Sourcing it can therefore never take over the shell of
    // whoever sourced it.
    expect(src).toContain('sh -s --')
    expect(src).toContain('cat "$BLOG_HANDOVER_SH"')
    expect(src).toContain('stage_blog_into_staging "$1" "$2" || exit 1')
  })

  it('no longer copies the blog with cp -a, which nests it', () => {
    expect(src).not.toContain('cp -a "$REMOTE_DIR/blog"')
    expect(src).not.toContain('cp -a $REMOTE_DIR/blog')
  })

  it('never puts an unquoted REMOTE_DIR into a remote command string', () => {
    // A remote command string is word-split by the remote shell, so a
    // REMOTE_DIR containing a space silently broke the hand-over. Every
    // remote command that mentions the directory has to use the quoted form.
    const remoteCommands = src.match(/ssh "\$HOST" "[^"]*"/g) ?? []
    expect(remoteCommands.length).toBeGreaterThan(0)
    for (const command of remoteCommands) {
      expect(command).not.toMatch(/\$REMOTE_DIR(?!_Q|_TMP_Q)/)
    }
  })
})


describe('the hand-over refuses rather than guessing', () => {
  it('reports its own message when it is called without its arguments', () => {
    // The shell that sources this file runs under "set -u", so a bare
    // "$1" aborted the whole deploy with an "unbound variable" error
    // instead of this function's own message.
    const res = spawnSync('sh', ['-c', 'set -u; . "$1"; bh_path_is_safe', 'module-test', modulePath], {
      encoding: 'utf8',
    })
    expect(res.stderr).toContain('must not be empty')
    expect(res.stderr).not.toContain('unbound variable')
  })

  it('rejects empty arguments instead of touching /blog', () => {
    const res = handOver('', '')
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('LIVE_ROOT')
  })

  it('rejects a dangling symlink in the staging tree', () => {
    // A broken link is not caught by -e, and the copy would write THROUGH
    // it, outside the web root.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    mkdirSync(staging, { recursive: true })
    symlinkSync(join(dir, 'nowhere'), join(staging, 'blog'))

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(existsSync(join(dir, 'nowhere'))).toBe(false)
  })
})

describe('the remote entry point turns a refusal into an exit status', () => {
  it('exits non-zero when the hand-over refuses', () => {
    // deploy.sh runs the module with "sh -s" on the host, so the refusal has
    // to reach the caller as an exit status, not just a return value.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    writeFile(join(staging, 'blog', 'page.html'), 'export')

    // Exactly what deploy.sh sends to the host: the module, then the call.
    const script =
      readFileSync(modulePath, 'utf8') +
      '\nstage_blog_into_staging "$1" "$2" || exit 1\n'
    const result = spawnSync(
      'sh',
      ['-s', '--', live, staging],
      { input: script, encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('both exist')
  })
})

describe('the hand-over carries the live blog and refuses the rest', () => {
  it('rejects a live blog that is not a directory', () => {
    // A blog that exists but is not a directory cannot be carried over, and
    // treating it as "no blog here" would drop it at the swap, which is the
    // 404 this script exists to prevent.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog'), 'not a directory')
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('not a directory')
  })

  it('prints a confirmation the caller can check', () => {
    // The remote side is fed over stdin, which can arrive empty or
    // truncated. The confirmation is what tells the caller the hand-over
    // actually ran.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('blog-handover: ok (carried ')
  })

  it('reports a missing blog/ distinctly from a carried one', () => {
    // "the live web root has no blog/" is a different fact from "blog/ was
    // carried over", and the caller checks the marker on stdout alone, so
    // the two must not be confusable.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    mkdirSync(live, { recursive: true })
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('blog-handover: no-blog (')
    expect(res.stdout).not.toContain('blog-handover: ok')
  })

  it('reports a live web root that is not there at all as its own fact', () => {
    // A first deploy to a host that has nothing yet has no live web root.
    // That is a different fact from a web root that IS there without the
    // blog, and the caller compares the marker exactly, so the two must
    // not be confusable: a mistyped REMOTE_DIR has to be visible.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('blog-handover: no-root (no web root at ')
    expect(res.stdout).not.toContain('blog-handover: no-blog')
    expect(existsSync(join(staging, 'blog'))).toBe(false)
  })
})

describe('the module refuses the paths that would be dangerous on its own', () => {
  it('refuses a staging root that does not exist', () => {
    // Creating it here would let a typo produce a staging tree holding
    // nothing but blog/, and the swap would then replace the whole site
    // with it.
    const dir = scratch()
    const live = join(dir, 'live')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    const staging = join(dir, 'missing-staging')

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('staging root')
    expect(existsSync(staging)).toBe(false)
  })

  it('refuses a staging root that is the live web root', () => {
    // The copy writes into the staging root and the cleanup deletes from
    // it, so a staging root that holds the live tree would delete the live
    // blog/ while copying it.
    const dir = scratch()
    const live = join(dir, 'live')
    writeFile(join(live, 'blog', 'feed.json'), 'live')

    const res = handOver(live, live)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('same directory')
  })

  it('refuses a staging root that contains the live web root', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    writeFile(join(live, 'blog', 'feed.json'), 'live')

    const res = handOver(live, dir)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('contains the live web root')
  })

  it('refuses a staging root inside the live web root', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    const staging = join(live, 'staging')
    mkdirSync(staging, { recursive: true })

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('inside the live web root')
  })

  it('refuses a source tree holding something that is not a file', () => {
    // A FIFO would make cp block forever, and the failure would only
    // surface after cp has already waited.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    mkdirSync(join(live, 'blog'), { recursive: true })
    mkdirSync(staging, { recursive: true })
    const fifo = join(live, 'blog', 'pipe')
    const mk = spawnSync('mkfifo', [fifo])
    if (mk.status !== 0) return // no mkfifo here, nothing to assert

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('not a regular file')
  })
})

describe('the path rules live in the module, and deploy.sh uses them', () => {
  // One implementation of what a safe path is: the module checks the roots
  // it is given, and deploy.sh checks REMOTE_DIR with the same functions.
  function moduleRun(code: string, path: string): { status: number; out: string } {
    const res = spawnSync(
      'sh',
      ['-c', '. "$1"; shift; ' + code, 'module-test', modulePath, path],
      {
        encoding: 'utf8',
      },
    )
    return { status: res.status ?? 1, out: (res.stdout ?? '') + (res.stderr ?? '') }
  }

  function isSafe(path: string): boolean {
    return moduleRun('bh_path_is_safe "$1" REMOTE_DIR', path).status === 0
  }

  it('trims a trailing slash, so the staging path stays a sibling', () => {
    // "/var/www/site/" would otherwise derive "/var/www/site/.tmp", a
    // directory inside the live web root, instead of "/var/www/site.tmp".
    const res = moduleRun('bh_trim_path "$1"', '/var/www/hansen-web/')
    expect(res.status).toBe(0)
    expect(res.out.trim()).toBe('/var/www/hansen-web')
  })

  it('refuses every spelling of the root', () => {
    for (const root of ['/', '//', '/.', '/./']) {
      expect(isSafe(root)).toBe(false)
    }
  })

  it('refuses a relative path that climbs above the current directory', () => {
    // "rm -rf .." deletes a parent the operator never named.
    expect(isSafe('..')).toBe(false)
    expect(isSafe('../site')).toBe(false)
  })

  it('refuses a path that starts with a dash', () => {
    // "rm -rf '-rf'" reads the path as an OPTION, not as a path, so the
    // guard has to refuse it before it reaches the destructive line.
    expect(isSafe('-rf')).toBe(false)
    expect(isSafe('--no-preserve-root')).toBe(false)
  })

  it('allows the relative paths a local deploy uses', () => {
    // These worked before this branch and must keep working: a local deploy
    // never leaves the host.
    expect(isSafe('site')).toBe(true)
    expect(isSafe('./site')).toBe(true)
    expect(isSafe('out/../site')).toBe(true)
  })

  it('refuses a .. component in remote mode', () => {
    // The remote host resolves ".." against its own tree, and a symlink
    // anywhere along the way can make it resolve somewhere else entirely.
    const res = moduleRun('require_no_parent_refs "$1" REMOTE_DIR', '/var/www/../etc')
    expect(res.status).not.toBe(0)
    expect(res.out).toContain("..' component")
  })

  it('deploy.sh checks REMOTE_DIR with the same function', () => {
    // deploy.sh must not carry its own copy of the path rules: it calls the
    // module's functions, so the two cannot disagree about what is safe.
    const src = readFileSync(deployShPath, 'utf8')
    expect(src).toContain('bh_path_is_safe')
    expect(src).toContain('bh_fold_path')
  })
})

describe('the remote path is quoted and the hand-over is confirmed', () => {
  const src = readFileSync(deployShPath, 'utf8')

  it('checks that the hand-over reported success', () => {
    // The hand-over is fed to the host over stdin. If that stdin arrives
    // empty or truncated, the remote shell runs an empty script, exits 0 and
    // prints nothing, and the swap that follows would drop blog/ with a
    // green deploy.
    // The expected confirmation is derived from the module's own marker
    // function, so the wording lives in one place and the two cannot drift.
    expect(src).toContain('bh_marker_ok')
    expect(src).toContain('bh_marker_noblog')
    expect(src).toContain('refusing to swap')
  })

  it('checks the local hand-over before the swap too', () => {
    // The local branch also deletes the live web root. Leaving the check to
    // "set -e" would work today, but it stops working the moment the call
    // is moved into an if/|| block.
    expect(src).toContain('if ! stage_blog_into_staging "$REMOTE_DIR" "$REMOTE_DIR.tmp"')
  })

  it('quotes a path with a space and a quote into a single argument', () => {
    const begin = src.indexOf('remote_quote() {')
    const end = src.indexOf('}', begin)
    if (begin === -1 || end === -1) {
      throw new Error('remote_quote not found in deploy.sh')
    }
    const fn = src.slice(begin, end + 1)
    const script =
      'set -u\n' + fn +
      '\nq="$(remote_quote "$1")"\neval "set -- $q"\necho "count=$# arg=$1"'
    const out = execFileSync('bash', ['-c', script, 'quote-test', "/var/www/han sen'web"], {
      encoding: 'utf8',
    })
    expect(out.trim()).toBe("count=1 arg=/var/www/han sen'web")
  })
})

describe('the remote hand-over writes exactly one line to stdout', () => {
  // The caller captures stdout and compares it with the expected
  // confirmation. Any other line on stdout - a folded path printed by a
  // helper, for instance - lands in front of the confirmation and breaks
  // the comparison, so every remote deploy would refuse to swap.
  function remoteHandover(live: string, staging: string) {
    const script =
      readFileSync(modulePath, 'utf8') +
      '\nstage_blog_into_staging "$1" "$2" || exit 1\n'
    const res = spawnSync('sh', ['-s', '--', live, staging], {
      input: script,
      encoding: 'utf8',
    })
    return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
  }

  it('writes nothing but the confirmation line', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    mkdirSync(staging, { recursive: true })

    const res = remoteHandover(live, staging)
    expect(res.status).toBe(0)
    expect(res.stdout).toBe('blog-handover: ok (carried ' + join(live, 'blog') + ')\n')
  })

  it('writes the no-root line over the wire when the live root is not there', () => {
    // The remote side compares the marker exactly, so the "no web root"
    // fact has to reach it as its own line.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    mkdirSync(staging, { recursive: true })

    const res = remoteHandover(live, staging)
    expect(res.status).toBe(0)
    expect(res.stdout).toBe('blog-handover: no-root (no web root at ' + live + ')\n')
  })

  it('writes nothing but the no-blog line when the live root has no blog', () => {
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    mkdirSync(live, { recursive: true })
    mkdirSync(staging, { recursive: true })

    const res = remoteHandover(live, staging)
    expect(res.status).toBe(0)
    // The marker names the web root that was inspected, so the operator
    // can confirm it is the expected one before the swap.
    expect(res.stdout).toBe('blog-handover: no-blog (no blog/ in ' + live + ')\n')
  })

  it('matches the confirmation deploy.sh compares against', () => {
    // deploy.sh derives the expected confirmation from the module's own
    // marker function, so the wording cannot drift between the two.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    mkdirSync(staging, { recursive: true })

    const expected = execFileSync(
      'sh',
      ['-c', '. "$1"; bh_marker_ok "$2"', 'marker-test', modulePath, live],
      { encoding: 'utf8' },
    )
    expect(remoteHandover(live, staging).stdout).toBe(expected)
  })
})

describe('the module refuses the paths that would delete the wrong tree', () => {
  it('refuses a staging root that reaches the live root through a symlink', () => {
    // The copy writes into the staging root and the cleanup deletes from
    // it, so a staging root that IS the live root, through a link, deletes
    // the live blog/ while copying it.
    const dir = scratch()
    const live = join(dir, 'live')
    const staging = join(dir, 'staging')
    writeFile(join(live, 'blog', 'feed.json'), 'live')
    mkdirSync(live, { recursive: true })
    symlinkSync(live, staging)

    const res = handOver(live, staging)
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('same directory')
  })

  it('refuses a path with a newline in it', () => {
    // The confirmation is one line, and a path with a newline in it spans
    // two, so the caller would never see the confirmation it expects.
    const dir = scratch()
    const res = handOver(join(dir, 'live') + '\n/blog', join(dir, 'staging'))
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('newline')
  })
})
