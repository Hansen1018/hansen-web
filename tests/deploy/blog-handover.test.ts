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
    expect(src).toContain('BLOG_HANDOVER_RUN=1 sh -s --')
    expect(src).toContain('< "$BLOG_HANDOVER_SH"')
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

    const result = spawnSync(
      'sh',
      ['-s', '--', live, staging],
      {
        input: readFileSync(modulePath, 'utf8'),
        encoding: 'utf8',
        env: { ...process.env, BLOG_HANDOVER_RUN: '1' },
      },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('both exist')
  })
})

describe('the hand-over refuses a tree it cannot carry over', () => {
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
    expect(res.stdout).toContain('blog-handover: ok')
  })
})

describe('deploy.sh validates REMOTE_DIR before it deletes anything', () => {
  // The validation lives in deploy.sh, so it is exercised the way deploy.sh
  // runs it: the function is extracted and sourced, then called.
  function validate(path: string): string {
    const src = readFileSync(deployShPath, 'utf8')
    const begin = '--- remote path validation (begin) ---'
    const end = '--- remote path validation (end) ---'
    const i = src.indexOf(begin)
    const j = src.indexOf(end)
    if (i === -1 || j === -1) {
      throw new Error('remote path validation markers not found in deploy.sh')
    }
    const block = src.slice(src.indexOf('validate_remote_dir() {', i), j)
    const script =
      'exec 2>&1\n' + block +
      '\nvalidate_remote_dir "$1" && echo "exit=0" || echo "exit=1"'
    return execFileSync('bash', ['-c', script, 'validate-test', path], {
      encoding: 'utf8',
    })
  }

  it('accepts an ordinary absolute path', () => {
    expect(validate('/var/www/hansen-web')).toContain('exit=0')
  })

  it('refuses a relative path, the root, and a .. component', () => {
    expect(validate('hansen-web')).toContain('absolute path')
    expect(validate('/')).toContain('root')
    expect(validate('/var/www/../etc')).toContain('..')
  })
})

describe('the remote path is quoted and the hand-over is confirmed', () => {
  const src = readFileSync(deployShPath, 'utf8')

  it('checks that the hand-over reported success', () => {
    // The hand-over is fed to the host over stdin. If that stdin arrives
    // empty or truncated, the remote shell runs an empty script, exits 0 and
    // prints nothing, and the swap that follows would drop blog/ with a
    // green deploy.
    expect(src).toContain('blog-handover: ok')
    expect(src).toContain('refusing to swap')
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
