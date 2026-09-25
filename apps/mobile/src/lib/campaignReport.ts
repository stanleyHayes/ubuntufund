import { CAMPAIGN_REPORT_REASONS, CAMPAIGN_REPORT_REASON_LABELS, type CampaignReportReason } from '@ubuntu-fund/types'
import { api } from './api'

export const CAMPAIGN_REPORT_DETAILS_MAX = 2000

/** Reason choices for the native report dialog, in the API's accepted order. */
export const campaignReportOptions = CAMPAIGN_REPORT_REASONS.map(value => ({ value, label: CAMPAIGN_REPORT_REASON_LABELS[value] }))

export function isCampaignReportReason(value: string): value is CampaignReportReason {
  return (CAMPAIGN_REPORT_REASONS as readonly string[]).includes(value)
}

/**
 * Build the `POST /campaigns/:id/report` body. Only a reason from the shared
 * list is ever sent; the server rejects anything else with a 400.
 */
export function campaignReportPayload(reason: string, description = ''): { reason: CampaignReportReason; description?: string } {
  if (!isCampaignReportReason(reason)) throw new Error('Choose a reason for your report.')
  const details = description.trim()
  if (details.length > CAMPAIGN_REPORT_DETAILS_MAX) throw new Error('Keep the details to 2,000 characters or fewer.')
  return details ? { reason, description: details } : { reason }
}

export async function reportCampaign(campaignId: string, reason: string, description = ''): Promise<void> {
  const body = campaignReportPayload(reason, description)
  await api.post(`/campaigns/${encodeURIComponent(campaignId)}/report`, body)
}
