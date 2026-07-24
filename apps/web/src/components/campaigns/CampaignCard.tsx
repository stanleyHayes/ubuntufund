import { useMemo, useState } from 'react'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { Link as RouterLink } from 'react-router-dom'
import { Card, ProgressBar } from '@ubuntu-fund/ui'
import type { Campaign } from '@ubuntu-fund/types'

const MS_PER_DAY = 86_400_000

interface CampaignCardProps {
  campaign: Campaign
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const [now] = useState(() => Date.now())
  const daysLeft = useMemo(
    () => Math.ceil((new Date(campaign.endDate).getTime() - now) / MS_PER_DAY),
    [campaign.endDate, now]
  )

  return (
    <Card
      imageUrl={campaign.imageUrls[0]}
      imageAlt={campaign.title}
      imageHeight={200}
      actions={
        <Button
          component={RouterLink}
          to={`/campaigns/${campaign.id}`}
          variant="contained"
          color="primary"
          size="small"
          fullWidth
        >
          View Campaign
        </Button>
      }
    >
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Chip label={formatCategory(campaign.category)} size="small" color="primary" variant="outlined" />
        {campaign.priority === 'critical' && <Chip label="Critical" size="small" color="error" />}
        {campaign.priority === 'urgent' && <Chip label="Urgent" size="small" color="warning" />}
      </Box>

      <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
        {campaign.title}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {truncate(campaign.description, 120)}
      </Typography>

      <ProgressBar
        current={campaign.raisedAmount}
        goal={campaign.goalAmount}
        currency={campaign.currency}
      />

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
      </Typography>
    </Card>
  )
}
