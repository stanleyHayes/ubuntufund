import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { CurrencyDisplay, ProgressBar, SHAPE } from '@ubuntu-fund/ui'

interface LiveCampaignProgressProps {
  campaignId: string
  initialProgress: {
    raisedAmount: number
    goalAmount: number
    currency: string
  }
}

export function LiveCampaignProgress({
  initialProgress,
}: LiveCampaignProgressProps) {
  const { raisedAmount, goalAmount, currency } = initialProgress

  const percentage = goalAmount > 0 ? Math.min(100, (raisedAmount / goalAmount) * 100) : 0
  const remaining = goalAmount - raisedAmount

  return (
    <Box>
      <ProgressBar
        current={raisedAmount}
        goal={goalAmount}
        currency={currency}
      />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mt: 2,
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: SHAPE.card,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
            Raised
          </Typography>
          <CurrencyDisplay
            amount={raisedAmount}
            currency={currency}
            variant="h6"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
            Progress
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {percentage.toFixed(1)}%
          </Typography>
        </Box>

        <Box sx={{ flex: 1, textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
            {remaining > 0 ? 'Still Needed' : 'Goal Reached'}
          </Typography>
          <CurrencyDisplay
            amount={Math.max(0, remaining)}
            currency={currency}
            variant="h6"
            sx={{ fontWeight: 700, color: remaining > 0 ? 'text.primary' : 'success.main' }}
          />
        </Box>
      </Box>
    </Box>
  )
}
