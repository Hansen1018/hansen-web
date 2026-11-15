import { execFileSync } from 'node:child_process'
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
