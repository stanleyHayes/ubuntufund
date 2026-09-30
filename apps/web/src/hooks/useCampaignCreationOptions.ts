import { useEffect, useState } from 'react'
import type { SubscriptionPlan } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

export interface CampaignCreationOptions {
  plan: SubscriptionPlan
  maxGoal: number | null
  activeCount: number
  creationBlockReason?: 'verification_required' | 'verification_limit' | 'plan_limit' | null
  totalCount?: number
  verificationCampaignLimit?: number
  canCreate: boolean
  canSplit: boolean
  splitEnabled: boolean
  /** Absent from APIs that predate campaigns on someone else's behalf. */
  canCreateOnBehalf?: boolean
  onBehalfBlockReason?: 'plan_required' | 'plan_limit' | 'verification_required' | 'unavailable' | null
  /**
   * `limit` -1 is unlimited; `feePercent` is added to the plan fee on these
   * campaigns. The consent flags are the current settings a new campaign gets.
   */
  onBehalf?: { limit: number; active: number; feePercent: number; publicationRequiresConsent?: boolean; donationsRequireConsent?: boolean; staffReviewRequired?: boolean }
}
export function useCampaignCreationOptions() {
  const [options, setOptions] = useState<CampaignCreationOptions | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    api.get<CampaignCreationOptions>('/campaigns/creation-options').then(data => {
      if (!cancelled) { setOptions(data); setError('') }
    }).catch(() => { if (!cancelled) setError('Could not verify your campaign limits. Retry before creating a campaign.') })
    return () => { cancelled = true }
  }, [attempt])
  return { options, error, retry: () => { setError(''); setAttempt(value => value + 1) } }
}
