import { Navigate } from 'react-router-dom'
import { LegalPageLayout } from '../components/LegalPageLayout'
import { getPolicyBySlug } from '../data/legal'

/**
 * Renders a single legal policy from the central {@link LEGAL_POLICIES} data by
 * slug, so every policy page shares one faithful source of content and layout.
 * An unknown slug redirects to the legal index rather than 404-ing.
 */
function LegalPolicyPage({ slug }: { slug: string }) {
  const policy = getPolicyBySlug(slug)
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
