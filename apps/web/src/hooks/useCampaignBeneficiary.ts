import { useCallback, useEffect, useState } from 'react'
import type { CampaignBeneficiaryDetails } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

/**
 * `GET /campaigns/:id/beneficiary` for the organizer and the linked
 * beneficiary. Nothing is requested while `enabled` is false. A refresh keeps
 * the last details on screen until the new ones arrive.
 */
export function useCampaignBeneficiary(campaignId: string, enabled: boolean) {
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const key = `${campaignId}:${revision}`
  const [state, setState] = useState<{ key: string; details: CampaignBeneficiaryDetails | null; error: string | null }>({ key: '', details: null, error: null })
  useEffect(() => {
    if (!enabled || !campaignId) return
    let active = true
    api.get<CampaignBeneficiaryDetails>(`/campaigns/${campaignId}/beneficiary`)
      .then((details) => { if (active) setState({ key, details, error: null }) })
      .catch((error: unknown) => {
        if (active) setState((previous) => ({ key, details: previous.details, error: error instanceof Error ? error.message : 'Could not load the beneficiary details.' }))
      })
    return () => { active = false }
  }, [campaignId, enabled, key])
  return {
    details: enabled ? state.details : null,
    error: enabled && state.key === key ? state.error : null,
    loading: enabled && !!campaignId && state.key !== key,
    refresh,
  }
}
