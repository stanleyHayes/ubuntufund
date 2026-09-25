import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LEGAL_POLICIES, getPolicyBySlug } from '@ubuntu-fund/types/src/legal'

/**
 * The legal pack is rendered on marketing, web and mobile. It used to promise
 * things that do not exist: a cookie consent/preferences control, a production
 * cookie table and third-party SDK list, an archive of historical versions, a
 * separate retention schedule, per-campaign organizer-agreement records and a
 * documented complaint-escalation process. These checks keep the text honest.
 */
const policyText = (slug: string) => {
  const policy = getPolicyBySlug(slug)
  if (!policy) throw new Error(`missing policy ${slug}`)
  return [policy.summary, policy.description, policy.panelTitle, policy.panelBody, policy.introduction, ...policy.sections.map((s) => `${s.title}\n${s.content}`)].join('\n')
}

const everyPolicy = LEGAL_POLICIES.map((p) => policyText(p.slug)).join('\n')

// Vitest runs with apps/marketing as the cwd.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') return []
    if (statSync(path).isDirectory()) return walk(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('legal pack describes what actually happens', () => {
  it.each([
    ['cookie preference controls', /revisit your preferences/i],
    ['a production cookie table', /cookie table/i],
    ['a production third-party notice', /production notice/i],
    ['an archive of historical versions', /historical versions remain available/i],
    ['a retention schedule', /retention schedule/i],
    ['per-campaign agreement records', /relevant campaign ID/i],
    ['a documented escalation process', /documented complaint and escalation process/i],
  ])('does not promise %s', (_label, pattern) => {
    expect(everyPolicy).not.toMatch(pattern)
  })

  it('cookie notice lists every browser-storage key the web and marketing apps write', () => {
    const cookies = policyText('cookies')
    const sources = [resolve(process.cwd(), '../web/src'), resolve(process.cwd(), 'src')].flatMap(walk)
    const keys = new Set(sources.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/'(uf_[a-z_]+)'/g)].map((m) => m[1])))
    expect(keys.size).toBeGreaterThan(5)
    for (const key of keys) expect(cookies, `${key} is stored but not disclosed`).toContain(key)
    expect(cookies).toContain('accessToken')
    expect(cookies).toContain('ujimora:tip-attempt:')
  })

  it('privacy notice no longer claims consent-managed cookies', () => {
    const privacy = policyText('privacy')
    expect(privacy).toMatch(/do not currently use cookies, analytics or advertising technologies/)
    expect(privacy).not.toMatch(/controlled through appropriate consent and preferences/)
  })
})
