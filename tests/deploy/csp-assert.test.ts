import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest runs with the project root as its cwd, which is where deploy.sh and
// deploy/csp-assert.sh live. Resolved from cwd rather than import.meta.url
// because that is not a file: URL under the jsdom environment.
const repoRoot = process.cwd()
const modulePath = join(repoRoot, 'deploy', 'csp-assert.sh')
const deployShPath = join(repoRoot, 'deploy.sh')

type Over = Record<string, string | null>

const BASE: Record<string, string> = {
  'default-src': "'self'",
  'img-src': "'self' data: https:",
  'style-src':
    "'self' 'unsafe-inline' https://artalk.hansendong.top https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  'script-src':
    "'self' 'unsafe-inline' https://artalk.hansendong.top https://busuanzi.ibruce.info https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://storage.ko-fi.com https://ko-fi.com",
  'font-src': "'self' data:",
  'connect-src':
    "'self' https://blog.hansendong.top https://artalk.hansendong.top wss://artalk.hansendong.top https://busuanzi.ibruce.info",
  'frame-src':
    "'self' https://www.youtube-nocookie.com https://player.bilibili.com https://ko-fi.com",
  'frame-ancestors': "'none'",
}

function policy(over: Over = {}): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(BASE)) {
    if (key in over) continue
    parts.push(key + ' ' + value)
  }
  for (const [key, value] of Object.entries(over)) {
    if (value === null) continue
    parts.push(key + ' ' + value)
  }
  return parts.join('; ') + ';'
}

const CONNECT_WITH_JS =
  "'self' https://cdn.jsdelivr.net https://blog.hansendong.top https://artalk.hansendong.top wss://artalk.hansendong.top https://busuanzi.ibruce.info"

const FONT_WITH_JS = "'self' data: https://cdn.jsdelivr.net"

// The policy the static host serves today, captured from
// https://blog.hansendong.top/ on 2026-11-15. connect-src and font-src no
// longer carry the jsdelivr origin PR #6 added, which is the drift this suite
// keeps visible.
const LIVE = policy()

// The same policy with the origins the host is missing.
const COMPLETE = policy({ 'connect-src': CONNECT_WITH_JS, 'font-src': FONT_WITH_JS })

const LOOKALIKE = policy({
  'connect-src': "'self' https://cdn.jsdelivr.net.evil.example",
  'font-src': FONT_WITH_JS,
})

function missingFor(policyText: string, moduleFile: string = modulePath): string[] {
  const script = 'source "$1"; csp_missing_directives "$2" || true'
  const out = execFileSync('bash', ['-c', script, 'csp-test', moduleFile, policyText], {
    encoding: 'utf8',
  })
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// Run the verification block exactly as deploy.sh runs it, extracted from
// deploy.sh itself so the wiring is covered too, not only the rules.
function wiredCheck(
  policyText: string,
  deploySource: string = readFileSync(deployShPath, 'utf8'),
): { weak: number; missing: string } {
  const begin = '# --- CSP critical-directive verification (begin) ---'
  const end = '# --- CSP critical-directive verification (end) ---'
  const i = deploySource.indexOf(begin)
  const j = deploySource.indexOf(end)
  if (i === -1 || j === -1) {
    throw new Error('CSP verification markers not found in deploy.sh')
  }
  const block = deploySource.slice(i, j + end.length)
  const script = [
    'set -uo pipefail',
    'missing_directives=""',
    'weak=0',
    'actual_value="$1"',
    '. "$2"',
    block,
    'echo "weak=$weak"',
    'echo "missing=$missing_directives"',
  ].join('\n')
  const out = execFileSync('bash', ['-c', script, 'wire-test', policyText, modulePath], {
    encoding: 'utf8',
  })
  const weak = out.match(/^weak=(\d+)$/m)?.[1] ?? ''
  const missing = out.match(/^missing=(.*)$/m)?.[1] ?? ''
  return { weak: Number(weak), missing }
}

describe('csp_missing_directives', () => {
  it('accepts a policy that carries every required origin', () => {
    expect(missingFor(COMPLETE)).toEqual([])
  })

  it('reports the two origins the live host is missing, and nothing else', () => {
    expect(missingFor(LIVE)).toEqual([
      'connect-src with https://cdn.jsdelivr.net',
      'font-src with https://cdn.jsdelivr.net',
    ])
  })

  it('does not require cdnjs in connect-src', () => {
    expect(missingFor(policy({ 'connect-src': CONNECT_WITH_JS, 'font-src': FONT_WITH_JS }))).toEqual(
      [],
    )
  })

  it('requires cdnjs in script-src, where it is actually used', () => {
    const noCdnjsScript = policy({
      'connect-src': CONNECT_WITH_JS,
      'font-src': FONT_WITH_JS,
      'script-src':
        "'self' 'unsafe-inline' https://artalk.hansendong.top https://busuanzi.ibruce.info https://cdn.jsdelivr.net https://storage.ko-fi.com https://ko-fi.com",
    })
    expect(missingFor(noCdnjsScript)).toEqual(['script-src with https://cdnjs.cloudflare.com'])
  })

  it('requires jsdelivr in script-src and in style-src', () => {
    const noJsScript = policy({
      'connect-src': CONNECT_WITH_JS,
      'font-src': FONT_WITH_JS,
      'script-src':
        "'self' 'unsafe-inline' https://artalk.hansendong.top https://busuanzi.ibruce.info https://cdnjs.cloudflare.com https://storage.ko-fi.com https://ko-fi.com",
    })
    expect(missingFor(noJsScript)).toEqual(['script-src with https://cdn.jsdelivr.net'])

    const noJsStyle = policy({
      'connect-src': CONNECT_WITH_JS,
      'font-src': FONT_WITH_JS,
      'style-src':
        "'self' 'unsafe-inline' https://artalk.hansendong.top https://cdnjs.cloudflare.com",
    })
    expect(missingFor(noJsStyle)).toEqual(['style-src with https://cdn.jsdelivr.net'])
  })

  it('requires jsdelivr in font-src, where the KaTeX webfonts come from', () => {
    const noJsFont = policy({ 'connect-src': CONNECT_WITH_JS })
    expect(missingFor(noJsFont)).toEqual(['font-src with https://cdn.jsdelivr.net'])
  })

  it('requires frame-ancestors and default-src', () => {
    expect(
      missingFor(
        policy({
          'connect-src': CONNECT_WITH_JS,
          'font-src': FONT_WITH_JS,
          'frame-ancestors': null,
        }),
      ),
    ).toEqual(["frame-ancestors 'none'"])
    expect(
      missingFor(
        policy({ 'connect-src': CONNECT_WITH_JS, 'font-src': FONT_WITH_JS, 'default-src': null }),
      ),
    ).toEqual(["default-src 'self'"])
  })

  it('rejects a prefix-junk directive', () => {
    const junk = policy({
      'connect-src': null,
      'connect-src-extra': "'self' https://cdn.jsdelivr.net",
      'font-src': FONT_WITH_JS,
    })
    expect(missingFor(junk)).toEqual(['connect-src with https://cdn.jsdelivr.net'])
  })

  it('rejects a lookalike host', () => {
    expect(missingFor(LOOKALIKE)).toEqual(['connect-src with https://cdn.jsdelivr.net'])
  })

  it('accepts the path-prefix and the specific-file source form', () => {
    expect(
      missingFor(policy({ 'connect-src': "'self' https://cdn.jsdelivr.net/", 'font-src': FONT_WITH_JS })),
    ).toEqual([])
    expect(
      missingFor(
        policy({ 'connect-src': "'self' https://cdn.jsdelivr.net/foo.js", 'font-src': FONT_WITH_JS }),
      ),
    ).toEqual([])
  })

  it('accepts the space-separated multi-source form', () => {
    expect(
      missingFor(
        policy({
          'connect-src': "'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
          'font-src': FONT_WITH_JS,
        }),
      ),
    ).toEqual([])
  })
})

describe('deploy.sh wires the rules in', () => {
  it('flags the live policy and passes the corrected one', () => {
    const live = wiredCheck(LIVE)
    expect(live.weak).toBe(1)
    expect(live.missing).toContain('connect-src with https://cdn.jsdelivr.net')
    expect(live.missing).toContain('font-src with https://cdn.jsdelivr.net')

    const complete = wiredCheck(COMPLETE)
    expect(complete.weak).toBe(0)
    expect(complete.missing).toBe('')
  })

  it('fails when the wiring no longer calls the rules', () => {
    const src = readFileSync(deployShPath, 'utf8')
    const target = 'csp_missing_directives "$actual_value"'
    if (!src.includes(target)) {
      throw new Error('wiring target not found in deploy.sh')
    }
    const broken = src.replace(target, 'true')
    expect(wiredCheck(LIVE, broken).weak).toBe(0)
  })
})

describe('the recommended policy snippets satisfy the verifier', () => {
  const snippets = [
    {
      name: 'nginx',
      file: 'deploy/nginx-security-headers.conf',
      pattern: /Content-Security-Policy "([^"]+)"/,
    },
    { name: 'npm', file: 'deploy/npm-security-headers.conf', pattern: /Content-Security-Policy: (.+)/ },
  ]

  for (const snippet of snippets) {
    it(snippet.name + ' snippet passes every rule', () => {
      const text = readFileSync(join(repoRoot, snippet.file), 'utf8')
      const policyText = text.match(snippet.pattern)?.[1]?.trim() ?? ''
      expect(policyText).not.toBe('')
      expect(missingFor(policyText)).toEqual([])
    })
  }
})

describe('the suite can detect a broken rule', () => {
  const anchors: { name: string; policy: string; expect: string[] }[] = [
    { name: 'complete', policy: COMPLETE, expect: [] },
    {
      name: 'live',
      policy: LIVE,
      expect: ['connect-src with https://cdn.jsdelivr.net', 'font-src with https://cdn.jsdelivr.net'],
    },
    { name: 'lookalike', policy: LOOKALIKE, expect: ['connect-src with https://cdn.jsdelivr.net'] },
  ]

  function mutantBreaksAnAnchor(mutantFile: string): boolean {
    return anchors.some((anchor) => {
      const got = missingFor(anchor.policy, mutantFile)
      return JSON.stringify(got) !== JSON.stringify(anchor.expect)
    })
  }

  function writeMutant(source: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'csp-mutant-'))
    const file = join(dir, 'csp-assert.sh')
    writeFileSync(file, source)
    return file
  }

  function ruleBlock(directive: string, origin: string): string {
    return [
      '  if ! csp_has_origin "$policy" ' + directive + ' ' + origin + '; then',
      '    printf "' + directive + ' with ' + origin + '\\n"',
      '    status=1',
      '  fi',
    ].join('\n')
  }

  it('fails when the connect-src jsdelivr rule is removed', () => {
    const src = readFileSync(modulePath, 'utf8')
    const block = ruleBlock('connect-src', 'https://cdn.jsdelivr.net')
    if (!src.includes(block)) {
      throw new Error('mutation target not found in deploy/csp-assert.sh')
    }
    expect(mutantBreaksAnAnchor(writeMutant(src.replace(block, '')))).toBe(true)
  })

  it('fails when the font-src jsdelivr rule is removed', () => {
    const src = readFileSync(modulePath, 'utf8')
    const block = ruleBlock('font-src', 'https://cdn.jsdelivr.net')
    if (!src.includes(block)) {
      throw new Error('mutation target not found in deploy/csp-assert.sh')
    }
    expect(mutantBreaksAnAnchor(writeMutant(src.replace(block, '')))).toBe(true)
  })

  it('fails when a rule points at the wrong directive', () => {
    const src = readFileSync(modulePath, 'utf8')
    const target = 'csp_has_origin "$policy" connect-src https://cdn.jsdelivr.net'
    if (!src.includes(target)) {
      throw new Error('mutation target not found in deploy/csp-assert.sh')
    }
    const mutant = src.replace(
      target,
      'csp_has_origin "$policy" connect-srcX https://cdn.jsdelivr.net',
    )
    expect(mutantBreaksAnAnchor(writeMutant(mutant))).toBe(true)
  })

  it('fails when the token boundary at the end of the host is dropped', () => {
    const src = readFileSync(modulePath, 'utf8')
    const target = '([[:space:];/]|$)'
    if (!src.includes(target)) {
      throw new Error('mutation target not found in deploy/csp-assert.sh')
    }
    const mutant = src.replace(target, '([a-z0-9.-]*|$)')
    expect(mutantBreaksAnAnchor(writeMutant(mutant))).toBe(true)
  })
})

describe('the repository layout the suite assumes', () => {
  it('has deploy.sh and the shared rules module where the suite looks for them', () => {
    expect(existsSync(deployShPath)).toBe(true)
    expect(existsSync(modulePath)).toBe(true)
  })
})
