import Grid from '@mui/material/Grid'
import type { Campaign } from '@ubuntu-fund/types'
import { CampaignCard } from './CampaignCard'

/** Cards in the opening row, which are above the fold on every viewport. */
const EAGER_COVERS = 3

interface CampaignGridProps {
  campaigns: Campaign[]
  /** First N campaigns render wider, as featured cards */
  featuredCount?: number
}

export function CampaignGrid({ campaigns, featuredCount = 0 }: CampaignGridProps) {
  return (
    <Grid container spacing={3}>
      {campaigns.map((campaign, index) => (
        <Grid
          key={campaign.id}
          size={index < featuredCount ? { xs: 12, sm: 6, md: 6 } : { xs: 12, sm: 6, md: 4 }}
        >
          <CampaignCard campaign={campaign} priority={index < EAGER_COVERS} />
        </Grid>
      ))}
    </Grid>
  )
}
