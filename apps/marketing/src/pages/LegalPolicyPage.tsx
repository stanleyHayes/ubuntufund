import { Navigate } from 'react-router-dom'
import { LegalPageLayout } from '../components/LegalPageLayout'
import { getPolicyBySlug } from '../data/legal'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { breadcrumbList } from '@ubuntu-fund/ui'

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
    'The cookie categories Ujimora uses, which are essential, how to change your choices, which third parties set them, how long they last and how updates work.',
  'billing-terms':
    'How Ujimora subscription plans are billed: monthly and annual cycles, renewal and cancellation, upgrades, downgrades, price changes and enterprise terms.',
}

/**
 * Renders a single legal policy from the central {@link LEGAL_POLICIES} data by
 * slug, so every policy page shares one faithful source of content and layout.
 * An unknown slug redirects to the legal index rather than 404-ing.
 */
function LegalPolicyPage({ slug }: { slug: string }) {
  const policy = getPolicyBySlug(slug)

  useSeo({
    title: policy ? `${policy.title} | Ujimora` : 'Policy not found | Ujimora',
    description: policy
      ? POLICY_DESCRIPTIONS[policy.slug] ?? policy.summary
      : 'That policy is no longer published. The Ujimora legal index lists every current policy, from terms of use and privacy to payouts, refunds and billing.',
    path: policy?.route ?? '/legal',
    type: 'website',
    robots: policy ? undefined : 'noindex, follow',
    jsonLd: policy
      ? breadcrumbList(SITE_ORIGIN, [
          { name: 'Home', path: '/' },
          { name: 'Legal', path: '/legal' },
          { name: policy.title },
        ])
      : undefined,
  })

  if (!policy) return <Navigate to="/legal" replace />

  return (
    <LegalPageLayout
      eyebrow={policy.eyebrow}
      title={policy.title}
      description={policy.description}
      icon={policy.icon}
      panelLabel={policy.panelLabel}
      panelTitle={policy.panelTitle}
      panelBody={policy.panelBody}
      introduction={policy.introduction}
      sections={policy.sections}
      contact={policy.contact}
      effectiveDate={`Effective ${policy.effectiveDate}`}
    />
  )
}

export default LegalPolicyPage
