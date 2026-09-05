import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import { CurrencyDisplay } from '@ubuntu-fund/ui'

interface LiveCampaignProgressProps {
  campaignId: string
  initialProgress: {
    raisedAmount: number
    goalAmount: number
    currency: string
  }
}

export function LiveCampaignProgress({ initialProgress }: LiveCampaignProgressProps) {
  const { raisedAmount, goalAmount, currency } = initialProgress
  const percentage = goalAmount > 0 ? Math.max(0, (raisedAmount / goalAmount) * 100) : 0

  return (
    <Box>
      <CurrencyDisplay amount={raisedAmount} currency={currency} variant="h3" sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '2.4rem' }, color: 'text.primary', overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0.75, mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
        <Typography variant="body2">raised toward a goal of</Typography>
        <CurrencyDisplay amount={goalAmount} currency={currency} variant="body2" sx={{ fontWeight: 600 }} />
      </Box>
      <LinearProgress variant="determinate" value={Math.min(100, percentage)} aria-label="Campaign funding progress" />
      <Typography variant="body2" sx={{ mt: 1, color: 'primary.main', fontWeight: 700 }}>{percentage.toFixed(0)}% funded</Typography>
    </Box>
  )
}
