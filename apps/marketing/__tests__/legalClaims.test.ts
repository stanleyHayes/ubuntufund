import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LEGAL_POLICIES, getPolicyBySlug } from '@ubuntu-fund/types/src/legal'
import { ORGANIZER_AGREEMENT_NOTICE } from '@ubuntu-fund/types/src/legal-acceptance'

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

/**
 * The text each policy is published with, and its effective date. Terms
 * section 15 promises material changes are published with an effective date,
 * so a policy whose text changes needs a new date: set it in legal.ts, log the
 * change in docs/compliance/LEGAL_REVISIONS.md, then record the new
 * fingerprint here. Dates never change LEGAL_ACCEPTANCE_VERSION.
 */
const PUBLISHED: Record<string, { effectiveDate: string; sha256: string }> = {
  'delete-account': { effectiveDate: '12 September 2026', sha256: '48e5b632cb69db39c35b692401529532380183e6d01682c7c65374ad4b8cdb22' },
  terms: { effectiveDate: '25 September 2026', sha256: '1f44b9d86dfe7ac265d93c52089accadca157b563c19dd866bc8aeb10432df7c' },
  privacy: { effectiveDate: '25 September 2026', sha256: '666da95f215522afe237612fc3441c40ae87d0f2b9c9f1b1d2296c285112677a' },
  'organizer-agreement': { effectiveDate: '25 September 2026', sha256: '5e0da530417c8997b64dd755734651427d7360f18be4ea5bcd128f534a9a1302' },
  'contributor-terms': { effectiveDate: '8 September 2026', sha256: '86000771228c6023d82cb8c96cdafcb8ef18a4c304455c0f543235cc8a879cfe' },
  'refund-policy': { effectiveDate: '8 September 2026', sha256: '8391898b228ebf3664bc903b28a30ba398d4e8444600d428092966e15cec7765' },
  'acceptable-use': { effectiveDate: '8 September 2026', sha256: '255d7c5a5c588e8d1a4e650be17a82a4f8f08af1a06209f86c21d7bffa44d78f' },
  cookies: { effectiveDate: '25 September 2026', sha256: 'd739f21890eca573046d80b24be7b8d911009fc5aa9d7beee10d589860cf242a' },
  'billing-terms': { effectiveDate: '25 September 2026', sha256: '7c2a73ad1bb1fcd89ae853cf24a79f5d79789ac126aed11c62398c8790630fe3' },
}

describe('legal policy effective dates', () => {
  it.each(LEGAL_POLICIES.map((policy) => [policy.slug, policy] as const))('%s shows the date its current text took effect', (slug, policy) => {
    const { effectiveDate, ...text } = policy
    const sha256 = createHash('sha256').update(JSON.stringify(text)).digest('hex')
    const published = PUBLISHED[slug]
    expect(published, `${slug} has no recorded fingerprint`).toBeDefined()
    if (sha256 !== published.sha256) {
      expect(effectiveDate, `${slug} text changed: give it the new publication date in legal.ts`).not.toBe(published.effectiveDate)
    }
    expect({ effectiveDate, sha256 }, `${slug}: log the revision in docs/compliance/LEGAL_REVISIONS.md and record the new fingerprint`).toEqual(published)
  })

  it('logs every current effective date in the revision record', () => {
    const log = readFileSync(resolve(process.cwd(), '../../docs/compliance/LEGAL_REVISIONS.md'), 'utf8')
    for (const policy of LEGAL_POLICIES) expect(log, policy.slug).toContain(`| ${policy.title} | ${policy.effectiveDate} |`)
  })
})

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
    const sources = [resolve(process.cwd(), '../web/src'), resolve(process.cwd(), 'src'), resolve(process.cwd(), '../../packages/ui/src')].flatMap(walk)
    // Quoted or template-literal keys, local or session storage: uf_* names and
    // ujimora:… / ujimora-… prefixes (ending in ':' or '-' right before the
    // closing quote or a `${…}`, so event names like 'ujimora:x-changed' are not keys).
    const keyPattern = /['"`](uf_[a-z_]+(?=['"`:])|ujimora[:-][a-z-]*[:-](?=['"`]|\$\{))/g
    const found = sources.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(keyPattern)].map((m) => m[1]))
    // Strings of the same shape that are not stored in the browser.
    const notStorage: Record<string, string> = {
      'ujimora-privacy-request-': 'file name of a downloaded data-rights export',
      uf_live_session: 'legacy key the live page only removes',
    }
    const keys = new Set(found.filter((key) => !(key in notStorage)))
    expect(keys.size).toBeGreaterThan(10)
    const wildcards = [...cookies.matchAll(/([\w:-]+)\*/g)].map((m) => m[1])
    for (const key of keys) {
      expect(cookies.includes(key) || wildcards.some((prefix) => key.startsWith(prefix)), `${key} is stored but not disclosed`).toBe(true)
    }
    // Keys built from other constants (browserSession's `${tokensKey}:received`).
    for (const key of ['accessToken', 'uf_tokens:received', 'ujimora:tip-attempt:', 'ujimora:publication-draft:', 'ujimora:checkout-attempt:']) expect(cookies).toContain(key)
  })

  it('cookie notice states how long drafts and payment handoffs really stay', () => {
    const cookies = policyText('cookies')
    expect(cookies).toMatch(/ujimora:publication-draft:\*[^•]*30 days[^•]*deleted when you sign out[^•]*not deleted when a session ends through inactivity/)
    expect(cookies).toMatch(/uf_pending_donations, session storage\) are removed once the payment succeeds, fails or expires/)
    expect(cookies).not.toMatch(/Removed when you sign out or after an hour of inactivity/)
  })

  it('organizer agreement describes the acceptance point campaign creation actually shows', () => {
    const acceptance = getPolicyBySlug('organizer-agreement')?.sections.find((s) => s.title === '10. Acceptance')?.content ?? ''
    expect(acceptance).toMatch(/You accept this Agreement when you submit a campaign/)
    expect(ORGANIZER_AGREEMENT_NOTICE).toMatch(/^By submitting this campaign, you agree to the Campaign Organizer Agreement/)
    // Both campaign-creation flows render the notice and link to the agreement.
    for (const file of ['../web/src/components/campaigns/CampaignForm.tsx', '../mobile/app/campaign/create.tsx']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')
      expect(source, file).toContain('{ORGANIZER_AGREEMENT_NOTICE}')
      expect(source, file).toMatch(/['"]\/organizer-agreement['"]/)
    }
    // The account-agreement checkbox does not name this agreement, so the
    // agreement must not claim to be accepted through it.
    const checkboxes = ['../web/src/components/auth/RegisterForm.tsx', '../web/src/components/auth/AccountAgreement.tsx', '../mobile/app/(auth)/register.tsx', '../mobile/app/account-agreement.tsx']
      .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
    if (!checkboxes.every((source) => /Organizer Agreement/.test(source))) expect(acceptance).not.toMatch(/accept the account agreement/i)
    // The Terms of Use bring the agreement in for organizers.
    expect(policyText('terms')).toMatch(/Organizers must also follow the Campaign Organizer Agreement/)
  })

  it('privacy notice discloses internal reporting without claiming no analytics at all', () => {
    const privacy = policyText('privacy')
    expect(privacy).toMatch(/do not currently use cookies or third-party analytics, tracking or advertising technologies/)
    expect(privacy).toMatch(/internal, aggregated reports on accounts, campaigns and transactions/)
    expect(privacy).not.toMatch(/do not currently use cookies, analytics or advertising/)
    expect(privacy).not.toMatch(/appropriately governed analytics/)
    expect(privacy).not.toMatch(/controlled through appropriate consent and preferences/)
    expect(policyText('cookies')).not.toMatch(/do not currently set cookies or use analytics/)
  })
})
