import { Share, Platform } from 'react-native'
import type { Campaign } from '@ubuntu-fund/types'

export async function shareCampaign(campaign: Campaign): Promise<void> {
  const url = `https://ubuntufund.com/campaigns/${campaign.id}`

  try {
    const result = await Share.share({
      message: `${campaign.title}\n\n${campaign.description?.slice(0, 200)}...\n\nSupport this campaign: ${url}`,
      url: Platform.OS === 'ios' ? url : undefined,
      title: campaign.title,
    })

    if (result.action === Share.sharedAction) {
      // Record share analytics
      try {
        await fetch(`http://localhost:8100/api/v1/campaigns/${campaign.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'mobile' }),
        })
      } catch {
        // Silently fail analytics
      }
    }
  } catch {
    // Share cancelled or failed
  }
}
