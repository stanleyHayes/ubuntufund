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
  // Most campaigns go live after automated screening; staff approval depends on
  // the goal and has no service level. Organizers pick any future end date, and
  // no endpoint edits or extends a submitted campaign.
  ['staff review of every campaign', /reviews every campaign/i],
  ['a review turnaround', /24[-–]48 hours/i],
  ['a 90-day campaign limit', /up to 90 days/i],
  ['campaign extensions', /extend once/i],
  ['editing a live campaign', /update the description, images,? and deadline/i],
  // Organizers are verified; campaigns are screened, not verified.
  ['verified campaigns', /verified campaigns?\b/i],
  ['human review of every campaign', /Human review\./],
]

const SEED = '../api/src/infrastructure/database/siteContentDefaults.json'
// The donor app shell is the default link preview for app.ujimora.com.
const WEB_SHELL = ['../web/index.html', '../web/public/site.webmanifest']

const sources: [string, string][] = [
  ['index.html', read('index.html')],
  ['public/site.webmanifest', read('public/site.webmanifest')],
  [SEED, read(SEED)],
  ...WEB_SHELL.map((path): [string, string] => [path, read(path)]),
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

  it.each(['index.html', '../web/index.html'])('search and social descriptions in %s agree with each other', (file) => {
    const html = read(file)
    const descriptions = [...html.matchAll(/(?:name|property)="(?:og:|twitter:)?description" content="([^"]+)"/g)].map((m) => m[1])
    expect(descriptions).toHaveLength(3)
    for (const description of descriptions) expect(description).toContain('reviewed campaigns, verified organizers and transparent donation records')
  })

  it('app manifests use the same description', () => {
    for (const file of ['public/site.webmanifest', '../web/public/site.webmanifest']) {
      expect((JSON.parse(read(file)) as { description: string }).description).toContain('reviewed campaigns, verified organizers and transparent donation records')
    }
  })

  it('the Help centre fallback and the seeded FAQ give the same corrected answers', () => {
    const seed = JSON.parse(read(SEED)) as { key: string; data: { items?: { question: string; answer: string }[] } }[]
    const faq = seed.find((block) => block.key === 'faq')?.data.items ?? []
    const help = read('src/pages/HelpPage.tsx')
    for (const question of ['How do I start a fundraising campaign?', 'How long can my campaign run?', "Can I edit my campaign after it's live?", 'How does Ujimora verify campaigns?']) {
      const answer = faq.find((item) => item.question === question)?.answer
      expect(answer, question).toBeDefined()
      expect(help, question).toContain(`a: '${answer!.replace(/'/g, "\\'")}'`)
    }
  })
})
