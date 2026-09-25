import type { CampaignCategory, CampaignStatus } from '@ubuntu-fund/types'
import type { CampaignSearchParams } from '@/hooks/useCampaigns'

export type ExploreSort = 'newest' | 'most_funded' | 'ending_soon'

/**
 * Server query for the Explore filters. "Ending soon" never lists campaigns
 * that have already ended unless the donor explicitly asks for Expired ones.
 */
export function exploreSearchParams(q: string, category: CampaignCategory | null, status: CampaignStatus | null, sort: ExploreSort): CampaignSearchParams {
  if (sort === 'ending_soon') return { q, category, status: status ?? 'open', sortBy: 'endDate', sortOrder: 'asc' }
  return { q, category, status, sortBy: sort === 'most_funded' ? 'fundedPercent' : 'createdAt', sortOrder: 'desc' }
}
