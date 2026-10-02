import { LEGAL_POLICIES } from '@ubuntu-fund/types/src/legal'
import { GUIDES, GUIDES_INDEX, type Guide } from '../data/guides.ts'

/**
 * Title and description for every marketing route, in one place.
 *
 * Two readers depend on this staying identical: the pages (via `useSeo`, after
 * JavaScript runs) and the build step in `prerenderHeads.ts`, which writes each
 * route's HTML so crawlers see the right title, description and canonical
 * before any JavaScript runs. Keep this module free of React and browser APIs;
 * the build imports it from Node.
 */
export const SITE_ORIGIN = 'https://ujimora.com'

export interface PageHead {
  title: string
  description: string
  /** Root-relative, no trailing slash (except '/'). Becomes the canonical. */
  path: string
  type?: 'website' | 'article'
  /** The fields below match useSeo's, so a page's own head can be written as is. */
  canonicalUrl?: string
  robots?: string
  image?: string
  imageAlt?: string
  jsonLd?: object | object[]
}

type StaticPath = '/' | '/about' | '/contact' | '/crypto' | '/features' | '/pricing' | '/blog' | '/help' | '/affiliates' | '/for-organizations' | '/legal'

const STATIC_PAGES: Record<StaticPath, Omit<PageHead, 'path'>> = {
  '/': {
    title: 'Ujimora | Crowdfunding & Online Fundraising in Ghana',
    description: 'Raise money in Ghana for medical bills, school fees, funerals and community projects. Verified organizers, donations in cedis by MoMo or card.',
  },
  '/about': {
    title: 'About Ujimora: our mission, model and team',
    description: 'Why Ujimora exists, how campaign records, review and updates fit together, and the Ghanaian team building clearer trust infrastructure for giving.',
  },
  '/contact': {
    title: 'Contact support and partnerships | Ujimora',
    description: 'Message the Ujimora team about your account, a campaign problem, a partnership idea, or a bug, and see the response times we publish for each request.',
  },
  '/crypto': {
    title: 'Crypto contribution guide | Ujimora',
    description: 'How the optional crypto checkout works: pick a supported currency and network, check the quote before it expires, then send with any required memo or tag.',
  },
  '/features': {
    title: 'Features for campaigns, creators and teams | Ujimora',
    description: "Explore Ujimora's tools: campaign updates and collaboration, creator tip jars, contributions and payouts, verification checks, referrals and themes.",
  },
  '/pricing': {
    title: 'Pricing and plans | Ujimora',
    description: 'Compare Ujimora plans side by side: active campaign limits, cedi goal caps, platform fees, team seats and included tools, paid for 30 days or a year at a time.',
  },
  '/blog': {
    title: 'Fundraising field notes | Ujimora blog',
    description: 'Practical guidance on campaign records, verification, diaspora giving and responsible fundraising in Ghana, from the Ujimora editorial team.',
  },
  '/help': {
    title: 'Help center: campaigns, giving, payouts | Ujimora',
    description: 'Search answers on starting a campaign, donating in cedis, wallet and mobile money payments, identity verification, and organization accounts.',
  },
  '/affiliates': {
    title: 'Affiliate program: 10% referral commission | Ujimora',
    description: 'Share your Ujimora referral link and earn a one-time 10% commission when someone you refer takes a paid plan. Payouts settle in cedis after a 14-day hold.',
  },
  '/for-organizations': {
    title: 'Organization workspace for NGOs and institutions | Ujimora',
    description: 'A shared workspace for Ghanaian NGOs, hospitals, schools, and faith groups to prepare campaigns, invite collaborators, track donations, and pass trust review.',
  },
  '/legal': {
    title: 'Legal policies and agreements | Ujimora',
    description: 'Every policy that governs Ujimora in one place: terms of use, privacy, organizer and contributor terms, payouts and refunds, acceptable use and cookies.',
  },
}

export function pageHead(path: StaticPath): PageHead {
  return { ...STATIC_PAGES[path], path, type: 'website' }
}

export const STATIC_PATHS = Object.keys(STATIC_PAGES) as StaticPath[]

/** A search guide's head (src/data/guides.ts). */
export function guideHead(guide: Pick<Guide, 'title' | 'description' | 'path'>): PageHead {
  return { title: guide.title, description: guide.description, path: guide.path, type: 'article' }
}

/** The guides index and every guide. */
export const GUIDE_HEADS: PageHead[] = [
  { title: GUIDES_INDEX.title, description: GUIDES_INDEX.description, path: GUIDES_INDEX.path, type: 'website' },
  ...GUIDES.map(guideHead),
]

/**
 * Search-result copy, one entry per policy route. The shared policy data carries
 * a one-line `summary` written for the index card; these are the longer versions
 * written for a results page, so no two of the eight policies compete for the
 * same snippet. A policy added later without an entry falls back to its summary.
 */
const POLICY_DESCRIPTIONS: Record<string, string> = {
  terms:
    'The rules for using Ujimora: accounts and eligibility, campaign and contribution terms, platform fees, payouts, refunds, prohibited use and dispute handling.',
  privacy:
    'What Ujimora collects about you, why it is needed, who it is shared with, how long it is kept, and your rights under Ghana’s Data Protection Act, 2012.',
  'organizer-agreement':
    'What campaign organizers commit to on Ujimora: accurate claims, verification, fees, payout eligibility, accountable use of funds and split beneficiaries.',
  'contributor-terms':
    'What contributing to a Ujimora campaign means: how payment works, when refunds apply, failed campaigns, chargebacks, and campaigns with several beneficiaries.',
  'refund-policy':
    'When Ujimora releases funds and when it refunds them: standard, priority, early and assisted payouts, holds, fee treatment and campaigns that miss target.',
  'acceptable-use':
    'Campaigns that may not run on Ujimora, the categories that need enhanced review, the enforcement actions available, and how to report a suspicious campaign.',
  cookies:
    'What Ujimora keeps in your browser: no tracking cookies, only storage for sign-in, display preferences, payment recovery and referrals, how long each lasts and how to clear it.',
  'billing-terms':
    'How Ujimora subscription plans are billed: monthly and annual cycles, renewal and cancellation, upgrades, downgrades, price changes and enterprise terms.',
}

export function policyHead(policy: { slug: string; title: string; summary: string; route: string }): PageHead {
  return { title: `${policy.title} | Ujimora`, description: POLICY_DESCRIPTIONS[policy.slug] ?? policy.summary, path: policy.route, type: 'website' }
}

export const POLICY_HEADS: PageHead[] = LEGAL_POLICIES.map(policyHead)

export function clampText(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, '')}…`
}

/** Post titles run long, so the brand suffix is dropped before the title is. */
export function brandedTitle(title: string): string {
  const branded = `${title} | Ujimora`
  return branded.length <= 60 ? branded : clampText(title, 60)
}

export function blogPostHead(post: { slug: string; title: string; excerpt: string; image?: string; imageAlt?: string }): PageHead {
  return {
    title: brandedTitle(post.title),
    description: clampText(post.excerpt, 158),
    path: `/blog/${post.slug}`,
    type: 'article',
    // The cover is the share image, when it is an absolute https URL.
    ...(post.image && /^https:\/\//i.test(post.image) ? { image: post.image, imageAlt: post.imageAlt || post.title } : {}),
  }
}
