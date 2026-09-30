import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded'
import type { SxProps, Theme } from '@mui/material/styles'
import type { CampaignOnBehalfSummary } from '@ubuntu-fund/types'

/** Tells donors who runs the campaign, who it is for, and whether they confirmed it. */
export function OnBehalfLine({ onBehalf, organizerName, sx }: {
  onBehalf: CampaignOnBehalfSummary
  organizerName?: string | null
  sx?: SxProps<Theme>
}) {
  const confirmed = onBehalf.beneficiaryConfirmed
  return (
    <Box sx={[{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
        {organizerName ? <>Organized by <Box component="strong" sx={{ color: 'text.primary' }}>{organizerName}</Box> on behalf of </> : 'Organized on behalf of '}
        <Box component="strong" sx={{ color: 'text.primary' }}>{onBehalf.beneficiaryName}</Box>
      </Typography>
      <Chip
        size="small"
        variant="outlined"
        color={confirmed ? 'success' : 'warning'}
        icon={confirmed ? <VerifiedRoundedIcon /> : <HourglassTopRoundedIcon />}
        label={confirmed ? 'Confirmed by the beneficiary' : 'Awaiting the beneficiary’s confirmation'}
        sx={{ fontWeight: 600, maxWidth: '100%' }}
      />
    </Box>
  )
}
