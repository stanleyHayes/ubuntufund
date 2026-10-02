import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDES, GUIDES_INDEX, SITE_PAGE_NAMES, copySegments, linkTargets, plainText } from '../src/data/guides'
import { pageUrl, routeHeads } from '../scripts/prerender'

/**
 * The search guides are the pages meant to rank for what people in Ghana
 * search when they need to raise money. These checks keep each one a distinct,
 * well-formed result: its own title, description and heading, within the
 * lengths a results page shows, linked from every page's footer, and with no
 * link to a page that does not exist.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const served = new Set(routeHeads().map((head) => head.path))

function allCopy(guide: (typeof GUIDES)[number]): string[] {
  return [
    guide.lead,
    guide.callout?.body ?? '',
    ...(guide.checklist?.items ?? []),
    ...guide.sections.flatMap((section) => [...(section.paragraphs ?? []), ...(section.bullets ?? []), ...(section.after ?? [])]),
    ...(guide.steps?.items.flatMap((step) => [step.title, step.body]) ?? []),
    ...guide.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ]
}

describe('search guides', () => {
  it('each has a distinct path, title, description and heading', () => {
    for (const key of ['path', 'title', 'description', 'h1', 'name'] as const) {
      const values = GUIDES.map((guide) => guide[key])
      expect(new Set(values).size, key).toBe(values.length)
    }
  })

  it.each(GUIDES.map((guide) => [guide.path, guide] as const))('%s fits a search result', (_path, guide) => {
    expect(guide.title.length, guide.title).toBeLessThanOrEqual(60)
    expect(guide.description.length, guide.description).toBeGreaterThanOrEqual(110)
    expect(guide.description.length, guide.description).toBeLessThanOrEqual(160)
    expect(guide.faqs.length).toBeGreaterThanOrEqual(4)
    expect(guide.sections.length).toBeGreaterThanOrEqual(3)
    expect(guide.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it.each(GUIDES.map((guide) => [guide.path, guide] as const))('%s links only to pages that exist', (_path, guide) => {
    const targets = [...allCopy(guide).flatMap(linkTargets), ...guide.related]
    for (const target of targets) {
      if (/^https?:\/\//.test(target)) {
        expect(target, 'external links are https').toMatch(/^https:\/\//)
        continue
      }
      expect(served.has(target) || target in SITE_PAGE_NAMES, `${guide.path} links to ${target}`).toBe(true)
    }
    for (const target of guide.related) expect(target, 'a guide does not list itself as related').not.toBe(guide.path)
  })

  it('reduces inline links to their text for structured data', () => {
    expect(plainText('Read [the guide](/guides) now.')).toBe('Read the guide now.')
    expect(copySegments('A [b](/c) d')).toEqual([{ text: 'A ' }, { label: 'b', href: '/c' }, { text: ' d' }])
    for (const guide of GUIDES) for (const faq of guide.faqs) expect(plainText(faq.answer)).not.toMatch(/\]\(|\[/)
  })

  it('are all in the sitemap, dated when their content last changed', () => {
    const sitemap = read('public/sitemap.xml')
    for (const guide of [...GUIDES, GUIDES_INDEX]) {
      expect(sitemap).toContain(`<url><loc>${pageUrl(guide)}</loc><lastmod>${guide.updated}</lastmod>`)
    }
  })

  it('are all linked from the footer on every page', () => {
    const footer = read('src/components/Footer.tsx')
    for (const path of [...GUIDES.map((guide) => guide.path), GUIDES_INDEX.path]) {
      expect(footer, `the footer links ${path}`).toContain(`to: '${path}'`)
    }
  })

  it('state the platform fees the owner set, and no others', () => {
    const fees = GUIDES.flatMap(allCopy).join(' ').match(/\b\d+(?:\.\d+)?%/g) ?? []
    expect(new Set(fees)).toEqual(new Set(['5%', '3.5%', '2%', '1%']))
  })
})
