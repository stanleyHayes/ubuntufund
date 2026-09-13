import { useCallback, useEffect, useState } from 'react'
import { getCampaignBySlug, type CampaignPublicView } from '@/lib/fundraising'

/** Public checkout/share data cannot survive a changed slug or a denied refresh. */
export function usePublicCampaign(slug?: string) {
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const key = `${slug ?? ''}:${revision}`
  const [state, setState] = useState<{ key: string; campaign: CampaignPublicView | null; error: string | null; notFound: boolean }>({ key: '', campaign: null, error: null, notFound: false })
  useEffect(() => {
    if (!slug) return
    let active = true
    getCampaignBySlug(slug).then(campaign => {
      if (active) setState({ key, campaign, error: null, notFound: false })
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load campaign'
      const notFound = /not\s*found|404|no\s*such|does not exist/i.test(message)
      if (active) setState({ key, campaign: null, error: notFound ? null : message, notFound })
    })
    return () => { active = false }
  }, [key, slug])
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  const current = state.key === key
  return { campaign: current ? state.campaign : null, error: current ? state.error : null, notFound: !slug || (current && state.notFound), isLoading: !!slug && !current }
}
