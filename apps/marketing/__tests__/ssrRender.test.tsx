// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from '../src/entry-server'
import { routeHeads } from '../scripts/prerender'
import { GUIDES } from '../src/data/guides'

/**
 * The build renders every route on the server (scripts/prerender.ts). These
 * render them the same way, in Node with no DOM, so a page that reaches for
 * window/localStorage while rendering, declares the wrong head, or renders
 * without a heading fails here instead of in the deploy.
 */
describe('server rendering', () => {
  const routes = routeHeads()

  it.each(routes.map((route) => [route.path, route] as const))('renders %s with its own head and one h1', (_path, route) => {
    const page = render(route.path, {})
    expect(page.head?.path).toBe(route.path)
    expect(page.head?.title).toBe(route.title)
    expect(page.head?.description).toBe(route.description)
    expect((page.html.match(/<h1[\s>]/g) ?? []).length).toBe(1)
    expect(page.styles).toContain('<style data-emotion="css ')
  })

  it('ships the webfont and the default look in the page styles, not after JavaScript', () => {
    const { styles } = render('/', {})
    expect(styles).toContain('data-emotion="css-global')
    expect(styles).toContain('@font-face')
    expect(styles).toContain('--neu-surface')
  })

  it('renders each guide’s copy, FAQ and structured data', () => {
    for (const guide of GUIDES) {
      const page = render(guide.path, {})
      expect(page.html).toContain(guide.h1.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'))
      for (const faq of guide.faqs) expect(page.html).toContain(faq.question.replace(/'/g, '&#x27;'))
      const types = ([] as { '@type': string }[]).concat(page.head?.jsonLd as never).map((node) => node['@type'])
      expect(types).toEqual(['BreadcrumbList', 'FAQPage'])
    }
  })

  it('renders live plans from build data instead of loading skeletons', () => {
    const plans = [
      { tier: 'free', name: 'Free', description: 'Start', priceMonthly: 0, priceYearly: 0, platformFeePercent: 5, maxActiveCampaigns: 1, maxCampaignGoal: 5000, sortOrder: 0, active: true, isPublic: true, features: [] },
      { tier: 'starter', name: 'Starter', description: 'Grow', priceMonthly: 9.99, priceYearly: 99, platformFeePercent: 3.5, maxActiveCampaigns: 3, maxCampaignGoal: 25000, sortOrder: 1, active: true, isPublic: true, features: [] },
    ]
    const page = render('/pricing', { plans })
    expect(page.html).toContain('Starter')
    expect(page.html).not.toContain('Loading current pricing')
    expect(page.data).toEqual({ plans })
    const types = ([] as { '@type': string }[]).concat(page.head?.jsonLd as never).map((node) => node['@type'])
    expect(types).toContain('FAQPage')
  })

  it('keeps the pricing heading while plans could not be loaded', () => {
    const page = render('/pricing', {})
    expect(page.html).toContain('Loading current pricing')
    expect(page.html).toContain('Clear pricing without hidden promises')
  })

  it('renders a blog post from build data and embeds only what the page read', () => {
    const post = { id: 'p1', slug: 'a-post', title: 'Giving in Ghana', excerpt: 'Why records matter.', body: 'First paragraph.', category: 'Guide', authorName: 'Ama Mensah', authorRole: 'Editor', image: '', imageAlt: '', featured: false, publishedAt: '2026-02-18T00:00:00.000Z', readTime: 3 }
    const page = render('/blog/a-post', { blog: [post], 'blog:a-post': post, plans: [] })
    expect(page.html).toContain('Giving in Ghana')
    expect(page.html).toContain('18 February 2026')
    expect(page.head?.path).toBe('/blog/a-post')
    expect(page.head?.robots).toBeUndefined()
    expect(Object.keys(page.data).sort()).toEqual(['blog', 'blog:a-post'])
    const article = ([] as { '@type': string; datePublished?: string; author?: { name: string } }[]).concat(page.head?.jsonLd as never).find((node) => node['@type'] === 'BlogPosting')
    expect(article).toMatchObject({ datePublished: '2026-02-18T00:00:00.000Z', author: { name: 'Ama Mensah' } })
  })

  it('uses CMS content the build fetched', () => {
    const page = render('/help', { 'content:faq': { items: [{ question: 'Can I give by MoMo?', answer: 'Yes, at checkout.', category: 'Donations' }] } })
    expect(page.data).toHaveProperty('content:faq')
  })

  it('renders the not-found page for unknown paths', () => {
    const page = render('/no-such-page', {})
    expect(page.head?.robots).toBe('noindex, follow')
  })
})
