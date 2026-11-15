import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest runs with the project root as its cwd, which is where deploy.sh and
// deploy/ live.
const repoRoot = process.cwd()
const modulePath = join(repoRoot, 'deploy', 'csp-assert.sh')

// The pattern used to escape only '.', and used the directive raw. Both
// halves of the pattern are ERE syntax, so both had to be escaped:
//   - an unescaped '+' in an origin made 'a+b' match 'aab', so a policy
//     naming a different host satisfied a rule it did not satisfy;
//   - an unescaped '.' in a directive made 'connect.src' match
//     'connect-src', so a rule for one directive was satisfied by another.
// Each case below is a measured false positive, not a hypothetical one.
function hasOrigin(
  policyText: string,
  directive: string,
  origin: string,
  moduleFile: string = modulePath,
): boolean {
  const script = 'source "$1"\ncsp_has_origin "$2" "$3" "$4" && echo yes || echo no'
  const out = execFileSync(
    'bash',
    ['-c', script, 'literal-test', moduleFile, policyText, directive, origin],
    { encoding: 'utf8' },
  )
  return out.trim() === 'yes'
}

describe('the origin and the directive are matched literally', () => {
  it('matches an origin containing a quantifier only literally', () => {
    expect(
      hasOrigin('connect-src https://a+b.example;', 'connect-src', 'https://a+b.example'),
    ).toBe(true)
    expect(
      hasOrigin('connect-src https://aab.example;', 'connect-src', 'https://a+b.example'),
    ).toBe(false)
  })

  it('does not let one directive satisfy the rule of another', () => {
    expect(
      hasOrigin('connect-src https://cdn.jsdelivr.net;', 'connect.src', 'https://cdn.jsdelivr.net'),
    ).toBe(false)
    expect(
      hasOrigin('connect-src https://cdn.jsdelivr.net;', 'connect-src', 'https://cdn.jsdelivr.net'),
    ).toBe(true)
  })

  it('still rejects a lookalike host and accepts the path form', () => {
    expect(
      hasOrigin(
        'connect-src https://cdn.jsdelivr.net.evil.example;',
        'connect-src',
        'https://cdn.jsdelivr.net',
      ),
    ).toBe(false)
    expect(
      hasOrigin(
        'connect-src https://cdn.jsdelivr.net/foo.js;',
        'connect-src',
        'https://cdn.jsdelivr.net',
      ),
    ).toBe(true)
  })

  it('detects the escaping being removed', () => {
    // Mutation check in the same spirit as the rule-removal mutations in
    // csp-assert.test.ts: if csp_escape_ere stopped escaping, the false
    // positive above would come back and the suite would stop being able to
    // see the defect.
    const src = readFileSync(modulePath, 'utf8')
    const start = src.indexOf('csp_escape_ere() {')
    if (start === -1) {
      throw new Error('csp_escape_ere not found in deploy/csp-assert.sh')
    }
    const end = src.indexOf('\n}\n', start)
    if (end === -1) {
      throw new Error('end of csp_escape_ere not found in deploy/csp-assert.sh')
    }
    const mutant =
      src.slice(0, start) +
      'csp_escape_ere() {\n  printf \'%s\' "$1"\n}' +
      src.slice(end + 3)
    const dir = mkdtempSync(join(tmpdir(), 'csp-escape-mutant-'))
    const file = join(dir, 'csp-assert.sh')
    writeFileSync(file, mutant)

    // The defect is back: 'a+b' is a quantifier again, so the policy naming
    // 'aab' satisfies the rule for 'a+b'.
    expect(
      hasOrigin(
        'connect-src https://aab.example;',
        'connect-src',
        'https://a+b.example',
        file,
      ),
    ).toBe(true)
  })
})


describe('a token has to be a single token', () => {
  it('rejects an origin or a directive carrying whitespace', () => {
    // The pattern anchors on token boundaries, so a value made of several
    // tokens would be compared against the wrong part of the policy.
    expect(
      hasOrigin('connect-src https://cdn.jsdelivr.net;', 'connect-src', 'https://cdn jsdelivr.net'),
    ).toBe(false)
    expect(
      hasOrigin('connect-src https://cdn.jsdelivr.net;', 'connect src', 'https://cdn.jsdelivr.net'),
    ).toBe(false)
  })

  it('does not match an origin sitting inside another host query string', () => {
    // The origin has to START a token. Without that, this policy satisfied
    // the connect-src rule for https://cdn.jsdelivr.net even though the
    // only host in it is example.org.
    expect(
      hasOrigin(
        "connect-src 'self' https://example.org/?u=https://cdn.jsdelivr.net;",
        'connect-src',
        'https://cdn.jsdelivr.net',
      ),
    ).toBe(false)
    expect(
      hasOrigin(
        'connect-src https://cdn.jsdelivr.net;',
        'connect-src',
        'https://cdn.jsdelivr.net',
      ),
    ).toBe(true)
  })

  it('detects the leading-boundary requirement being removed', () => {
    // If the origin is allowed to appear anywhere in the directive value,
    // the query-string case above matches again, and the suite would stop
    // being able to see the defect.
    const src = readFileSync(modulePath, 'utf8')
    // Restoring the old shape (anything at all between the directive and
    // the origin) is the regression: the query-string case then matches.
    const target = '([^;]*[[:space:]])?'
    if (!src.includes(target)) {
      throw new Error('leading-boundary group not found in deploy/csp-assert.sh')
    }
    const mutant = src.replace(target, '[^;]*')
    const dir = mkdtempSync(join(tmpdir(), 'csp-boundary-mutant-'))
    const file = join(dir, 'csp-assert.sh')
    writeFileSync(file, mutant)

    const script =
      'source "$1"\ncsp_has_origin "$2" "$3" "$4" && echo yes || echo no'
    const out = execFileSync(
      'bash',
      [
        '-c',
        script,
        'boundary-mutant',
        file,
        "connect-src 'self' https://example.org/?u=https://cdn.jsdelivr.net;",
        'connect-src',
        'https://cdn.jsdelivr.net',
      ],
      { encoding: 'utf8' },
    )
    expect(out.trim()).toBe('yes')
  })
})
