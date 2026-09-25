import type { CampaignUpdate, CampaignUpdateType, CreateCampaignUpdateInput } from '@ubuntu-fund/types'
import { api } from './api'

export const CAMPAIGN_UPDATE_TYPES: { value: CampaignUpdateType; label: string }[] = [
  { value: 'general', label: 'General update' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'thank_you', label: 'Thank you' },
  { value: 'urgent', label: 'Urgent' },
]

export interface CampaignUpdateDraft {
  title: string
  content: string
  type: string
  isPinned: boolean
  automatedReviewConsent: boolean
}

/** Same limits as the API validator and the web composer. */
export function campaignUpdatePayload(draft: CampaignUpdateDraft): CreateCampaignUpdateInput {
  const title = draft.title.trim(), content = draft.content.trim()
  if (title.length < 3 || title.length > 200) throw new Error('Use a title between 3 and 200 characters.')
  if (!content || content.length > 5000) throw new Error('Write an update of up to 5,000 characters.')
  const type = CAMPAIGN_UPDATE_TYPES.find(option => option.value === draft.type)?.value
  if (!type) throw new Error('Choose an update type.')
  return { title, content, type, isPinned: draft.isPinned, automatedReviewConsent: draft.automatedReviewConsent }
}

const updatesPath = (campaignId: string) => `/campaigns/${encodeURIComponent(campaignId)}/updates`

export function postCampaignUpdate(campaignId: string, draft: CampaignUpdateDraft) {
  return api.post<CampaignUpdate>(updatesPath(campaignId), campaignUpdatePayload(draft))
}

/** Pinning is a toggle on the server: pinned updates are unpinned. */
export function toggleCampaignUpdatePin(campaignId: string, updateId: string) {
  return api.post<CampaignUpdate>(`${updatesPath(campaignId)}/${encodeURIComponent(updateId)}/pin`)
}

export function deleteCampaignUpdate(campaignId: string, updateId: string) {
  return api.delete(`${updatesPath(campaignId)}/${encodeURIComponent(updateId)}`)
}
