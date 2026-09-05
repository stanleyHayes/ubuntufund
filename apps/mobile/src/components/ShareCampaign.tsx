import { Share, Platform } from 'react-native'
import type { Campaign } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

export async function shareCampaign(campaign: Campaign): Promise<void> {
  const url = `https://ujimora.com/campaigns/${campaign.id}`

  try {
    const result = await Share.share({
      message: `${campaign.title}\n\n${campaign.description?.slice(0, 200)}...\n\nSupport this campaign: ${url}`,
      url: Platform.OS === 'ios' ? url : undefined,
      title: campaign.title,
    })

    if (result.action === Share.sharedAction) {
      // Record share analytics
      try {
        await api.post(`/campaigns/${campaign.id}/share`, { platform: 'mobile' })
      } catch {
        // Silently fail analytics
      }
    }
  } catch {
    // Share cancelled or failed
  }
}
