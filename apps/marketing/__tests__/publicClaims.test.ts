import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Public copy must describe what the product actually does. The site, its
 * search/social metadata and the seeded FAQ used to promise escrow protection,
 * community trust scores, frozen funds, permanent bans, worldwide card
 * acceptance and Google/Facebook sign-in, none of which exist, and the escrow
 * claim contradicts the Terms ("not an automatic all-or-nothing escrow
 * instruction").
 *
 * These checks fail if one of those claims is reintroduced into the marketing
 * site or the CMS seed that populates its FAQ.
 */
// Vitest runs with apps/marketing as the cwd.
const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.(tsx?|json)$/.test(name) ? [path] : []
  })
}

const FALSE_CLAIMS: [string, RegExp][] = [
  // `escrowSupport` is the plan-feature key; the claim is the word in copy.
  ['escrow', /escrow(?!Support)/i],
  ['trust score', /trust[- ]scores?/i],
  ['social sign-in', /(Google|Facebook) or (Google|Facebook)/i],
  ['worldwide donations', /anyone worldwide/i],
  ['frozen funds', /funds are frozen/i],
  ['permanent bans', /permanently banned/i],
  ['tax deductibility', /tax[- ]deductib/i],
]

const SEED = '../api/src/infrastructure/database/siteContentDefaults.json'

const sources: [string, string][] = [
  ['index.html', read('index.html')],
  ['public/site.webmanifest', read('public/site.webmanifest')],
  [SEED, read(SEED)],
  ...walk(resolve(root, 'src')).map((path): [string, string] => [path.slice(root.length + 1), readFileSync(path, 'utf8')]),
]

describe('public marketing claims', () => {
  it.each(FALSE_CLAIMS)('never claims %s', (_label, pattern) => {
    for (const [file, text] of sources) {
      const match = text.match(pattern)
      expect(match?.[0], `${file} contains "${match?.[0]}"`).toBeUndefined()
    }
  })

  it('seeded FAQ keeps no trust-score entry and describes the real enforcement', () => {
    const seed = JSON.parse(read(SEED)) as { key: string; data: { items?: { question: string; answer: string }[] } }[]
    const faq = seed.find((block) => block.key === 'faq')?.data.items ?? []
    expect(faq.length).toBeGreaterThan(10)
    expect(faq.some((item) => /trust score/i.test(item.question))).toBe(false)
    const fraud = faq.find((item) => item.question === 'What happens if a campaign is fraudulent?')
    expect(fraud?.answer).toMatch(/hold payouts that have not yet been approved/)
  })

  it('search and social descriptions agree with each other', () => {
    const html = read('index.html')
    const descriptions = [...html.matchAll(/(?:name|property)="(?:og:|twitter:)?description" content="([^"]+)"/g)].map((m) => m[1])
    expect(descriptions).toHaveLength(3)
    for (const description of descriptions) expect(description).toContain('reviewed campaigns, verified organizers and transparent donation records')
  })
})
