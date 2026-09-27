import { Navigate } from 'react-router-dom'
import { LegalPageLayout } from '../components/LegalPageLayout'
import { getPolicyBySlug } from '../data/legal'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { policyHead } from '@/lib/pageSeo'
import { breadcrumbList } from '@ubuntu-fund/ui'

/**
 * Renders a single legal policy from the central {@link LEGAL_POLICIES} data by
 * slug, so every policy page shares one faithful source of content and layout.
 * An unknown slug redirects to the legal index rather than 404-ing.
 */
function LegalPolicyPage({ slug }: { slug: string }) {
  const policy = getPolicyBySlug(slug)

  useSeo({
    ...(policy ? policyHead(policy) : {
      title: 'Policy not found | Ujimora',
      description: 'That policy is no longer published. The Ujimora legal index lists every current policy, from terms of use and privacy to payouts, refunds and billing.',
      path: '/legal',
      type: 'website' as const,
    }),
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
      actions={policy.actions}
      sections={policy.sections}
      contact={policy.contact}
      effectiveDate={`Effective ${policy.effectiveDate}`}
    />
  )
}

export default LegalPolicyPage
