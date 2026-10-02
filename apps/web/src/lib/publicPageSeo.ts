/**
 * The search head of each public page that has its own record: a campaign, an
 * organization and a creator.
 *
 * Two readers depend on these staying identical: the pages themselves (through
 * useSeo, once the record has loaded in the browser) and middleware.ts, which
 * answers search engines and AI crawlers with the same head and the record's
 * text already in the HTML (crawlerPages.ts). If the two disagreed, a crawler
 * would see one title and canonical and a browser another.
 *
 * No imports, React or browser APIs: Vercel loads the middleware's helpers as
 * plain Node.js modules. The JSON-LD builders mirror breadcrumbList() and
 * organization() in packages/ui/src/jsonLd.ts, which the middleware cannot
 * import; a test holds them equal.
 */

export const APP_ORIGIN = 'https://app.ujimora.com'

/** What useSeo takes; the fields a public page sets. */
export interface PublicPageSeo {
  title: string
  description: string
  path: string
  canonicalUrl?: string
  type?: 'website' | 'article'
  image?: string
  robots?: string
  jsonLd?: object | object[]
}

/** Collapse whitespace and trim to `max` characters at a word boundary. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:—-]+$/, '')}…`
}

const httpsOnly = (url: string | undefined | null): string | undefined => (url && /^https?:\/\//i.test(url) ? url : undefined)

export interface BreadcrumbItem {
  name: string
  path?: string
}

/** Same output as breadcrumbList() in packages/ui/src/jsonLd.ts. */
export function breadcrumbTrail(origin: string, items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: `${origin}${crumb.path}` } : {}),
    })),
  }
}

/** Same output as organization() in packages/ui/src/jsonLd.ts. */
export function organizationNode(node: { name: string; url: string; description?: string; logo?: string; areaServed?: string; sameAs?: string[] }): object {
  const sameAs = node.sameAs?.filter((url) => /^https?:\/\//i.test(url)) ?? []
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: node.name,
    url: node.url,
    ...(node.description ? { description: node.description } : {}),
    ...(node.logo ? { logo: node.logo } : {}),
    ...(node.areaServed ? { areaServed: node.areaServed } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

// ── Campaigns ──────────────────────────────────────────────

/** Statuses a campaign page must never be indexed in: not public yet, or no longer. */
export const UNINDEXED_CAMPAIGN_STATUSES: readonly string[] = ['draft', 'pending_review', 'blocked']

export interface CampaignSeoSource {
  id: string
  slug?: string
  title: string
  description: string
  status: string
  imageUrls?: string[]
  socialPreview?: { summary?: string; imageUrl?: string }
}

/** Meta description built from the organizer's own story, topped up when it is very short. */
export function campaignDescription(story: string): string {
  const blurb = clip(story || '', 155)
  if (blurb.length >= 100) return blurb
  return `${blurb ? `${blurb} ` : ''}Donate by mobile money or card on Ujimora.`
}

/** The public URL a campaign names as itself: its slug, or its id when it has none. */
export function campaignPath(campaign: Pick<CampaignSeoSource, 'id' | 'slug'>): string {
  return `/c/${encodeURIComponent(campaign.slug || campaign.id)}`
}

/** The head of a campaign page (/c/:slug, and /campaigns/:id, which canonicalises to it). */
export function campaignSeo(campaign: CampaignSeoSource, origin = APP_ORIGIN): PublicPageSeo {
  return {
    title: `${clip(campaign.title, 46)} | Ujimora`,
    description: campaignDescription(campaign.socialPreview?.summary || campaign.description),
    path: campaignPath(campaign),
    type: 'article',
    image: httpsOnly(campaign.socialPreview?.imageUrl ?? campaign.imageUrls?.[0]),
    robots: UNINDEXED_CAMPAIGN_STATUSES.includes(campaign.status) ? 'noindex, follow' : undefined,
    jsonLd: breadcrumbTrail(origin, [{ name: 'Home', path: '/' }, { name: 'Explore', path: '/explore' }, { name: campaign.title }]),
  }
}

/** The head of a campaign's checkout: never indexed, and it points at the campaign. */
export function campaignDonateSeo(campaign: Pick<CampaignSeoSource, 'id' | 'slug' | 'title'> | null, slug: string, origin = APP_ORIGIN): PublicPageSeo {
  return {
    title: campaign ? `Donate to ${campaign.title} | Ujimora` : 'Donate | Ujimora',
    description: 'Choose an amount in cedis and give securely by mobile money or card. No account needed. Review your donation details after payment.',
    path: `/c/${encodeURIComponent(slug)}/donate`,
    canonicalUrl: `${origin}/c/${encodeURIComponent(slug)}`,
    robots: 'noindex, follow',
  }
}

// ── Organizations ──────────────────────────────────────────

export interface OrganizationSeoSource {
  name: string
  slug: string
  description?: string
  impactStatement?: string
  logoUrl?: string
  coverUrl?: string
  country?: string
  website?: string
}

/** Meta description built from the organization's own words, topped up when they are very short. */
export function organizationDescription(org: Pick<OrganizationSeoSource, 'description' | 'impactStatement'>): string {
  const blurb = clip(org.description || org.impactStatement || '', 155)
  if (blurb.length >= 95) return blurb
  return `${blurb ? `${blurb} ` : ''}See their campaigns and total raised in cedis on Ujimora.`
}

export function organizationSeo(org: OrganizationSeoSource, origin = APP_ORIGIN): PublicPageSeo {
  const path = `/organizations/${encodeURIComponent(org.slug)}`
  return {
    title: `${clip(org.name, 44)} | Ujimora`,
    description: organizationDescription(org),
    path,
    image: httpsOnly(org.coverUrl || org.logoUrl),
    // An organization profile is a real entity claim, so it gets an identity
    // node alongside the trail. Only fields the record actually holds are
    // emitted, and only the website it declared itself is claimed as sameAs.
    jsonLd: [
      breadcrumbTrail(origin, [{ name: 'Home', path: '/' }, { name: 'Organizations', path: '/organizations' }, { name: org.name }]),
      organizationNode({
        name: org.name,
        url: `${origin}${path}`,
        description: org.description || org.impactStatement || undefined,
        logo: httpsOnly(org.logoUrl),
        areaServed: org.country || undefined,
        sameAs: org.website ? [org.website] : undefined,
      }),
    ],
  }
}

// ── Creators ───────────────────────────────────────────────

export interface CreatorSeoSource {
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  coverUrl?: string
  avatarUrl?: string
}

/** Meta description built from the creator's own tagline or bio, topped up when it is very short. */
export function creatorDescription(creator: Pick<CreatorSeoSource, 'displayName' | 'tagline' | 'bio'>): string {
  const blurb = clip(creator.tagline || creator.bio || '', 155)
  if (blurb.length >= 95) return blurb
  const firstName = clip(creator.displayName.split(' ')[0] || creator.displayName, 18)
  return `${blurb ? `${blurb} ` : ''}Send ${firstName} a tip on Ujimora — no account needed.`
}

export function creatorSeo(creator: CreatorSeoSource, origin = APP_ORIGIN): PublicPageSeo {
  return {
    title: `Support ${clip(creator.displayName, 34)} | Ujimora`,
    description: creatorDescription(creator),
    path: `/creators/${encodeURIComponent(creator.handle)}`,
    image: httpsOnly(creator.coverUrl || creator.avatarUrl),
    jsonLd: breadcrumbTrail(origin, [{ name: 'Home', path: '/' }, { name: creator.displayName }]),
  }
}
