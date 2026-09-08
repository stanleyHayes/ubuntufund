import { Box, Button, Typography } from '@mui/material'
import { SHAPE } from '@ubuntu-fund/ui'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'

const emptyReportContent = {
  safety: { icon: ShieldRoundedIcon, title: 'Safety insights will appear here', description: 'Platform safety metrics will be shown when reporting data is available.', caption: 'Monitor safety signals over time' },
  activity: { icon: HistoryRoundedIcon, title: 'Activity will appear here', description: 'Recent donations will show who gave, which campaign they supported, and when.', caption: 'Keep up with the latest giving' },
  topCampaigns: { icon: EmojiEventsRoundedIcon, title: 'Room for your leading campaigns', description: 'Once campaigns are available, they will be ranked here by the amount raised.', caption: 'Follow fundraising progress' },
  verification: { icon: VerifiedUserRoundedIcon, title: 'Verification starts with your community', description: 'Registered users will be grouped here by their verification level.', caption: 'Understand account verification coverage' },
  payments: { icon: PaymentsRoundedIcon, title: 'See how your community gives', description: 'Payment methods will appear here as donations are recorded.', caption: 'Understand the ways people contribute' },
  trust: { icon: ShieldRoundedIcon, title: 'Trust takes a community', description: 'User trust scores will be grouped into ranges when user data is available.', caption: 'See the distribution of trust scores' },
  trends: { icon: ShowChartRoundedIcon, title: 'Your donation story starts here', description: 'Monthly donation totals will appear here as contributions are recorded.', caption: 'Track how giving grows over time' },
  categories: { icon: DonutLargeRoundedIcon, title: 'Every cause has a place', description: 'Once donations are recorded, this report will show how support is shared across campaign categories.', caption: 'See which causes receive support' },
  geography: { icon: PublicRoundedIcon, title: 'See where your impact reaches', description: 'Campaign and donation totals will appear by location when geographic activity is available.', caption: 'Explore the communities behind the numbers' },
  campaigns: { icon: CampaignRoundedIcon, title: 'The first campaign starts the picture', description: 'Campaigns will be grouped by status here, from pending review to funded.', caption: 'Follow campaigns through each stage' },
}

export function EmptyReport({ kind, error = false }: { kind: keyof typeof emptyReportContent; error?: boolean }) {
  const content = emptyReportContent[kind]
  const Icon = error ? CloudOffRoundedIcon : content.icon
  return (
    <Box data-report-empty={kind} sx={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', px: { xs: 1, sm: 3 }, py: 3 }}>
      <Box aria-hidden="true" sx={{ position: 'relative', width: 108, height: 90, display: 'grid', placeItems: 'center', mb: 2 }}>
        <Box sx={{ position: 'absolute', width: 86, height: 86, borderRadius: '50%', border: '1px dashed', borderColor: 'divider' }} />
        <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: SHAPE.card,
          bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)', border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', color: error ? 'warning.main' : 'primary.main' }}>
          <Icon sx={{ fontSize: 32 }} />
        </Box>
        {!error && <Box sx={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', right: 10, top: 9, bgcolor: 'secondary.main', border: '3px solid', borderColor: 'background.paper' }} />}
      </Box>
      <Typography component="h3" sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary', mb: 1, lineHeight: 1.4 }}>
        {error ? 'This report couldn’t be loaded' : content.title}
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'text.secondary', maxWidth: 340 }}>
        {error ? 'We couldn’t retrieve the latest activity. Try refreshing to load this report again.' : content.description}
      </Typography>
      {error ? <Button startIcon={<RefreshRoundedIcon />} onClick={() => window.location.reload()} sx={{ mt: 2, borderRadius: SHAPE.sm, textTransform: 'none' }}>Retry reports</Button> :
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 2.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{content.caption}</Typography>}
    </Box>
  )
}

export type EmptyReportKind = keyof typeof emptyReportContent
