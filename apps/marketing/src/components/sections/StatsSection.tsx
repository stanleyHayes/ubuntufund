import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import { useContent } from '../../hooks/useContent'

const STATS_FALLBACK = {
  items: [
    { value: 'GHS', label: 'Launch currency' },
    { value: 'Web + mobile', label: 'Client access' },
    { value: 'Admin-reviewed', label: 'Campaign workflow' },
    { value: 'Soft-delete', label: 'Record policy' },
  ],
}

// Translate the original policy labels into public-facing copy; custom CMS values remain intact.
const foundations = {
  GHS: { icon: PaymentsRoundedIcon, title: 'Give in cedis', label: 'Local currency', detail: 'Campaign goals and contributions, clearly shown in GHS.' },
  'Web + mobile': { icon: DevicesRoundedIcon, title: 'Stay connected', label: 'Web & mobile', detail: 'Follow the causes you care about, wherever you are.' },
  'Admin-reviewed': { icon: VerifiedUserRoundedIcon, title: 'Reviewed with care', label: 'Campaign review', detail: 'Campaign details go through review before publication.' },
  'Soft-delete': { icon: HistoryRoundedIcon, title: 'A history that matters', label: 'Accountable records', detail: 'Records stay available for review when activity is removed.' },
}

function StatsSection() {
  const { items: stats } = useContent('marketing.stats', STATS_FALLBACK)
  return (
    <Box component="section" id="platform-foundations" aria-label="Platform foundations" sx={{ py: { xs: 5, md: 7 }, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box aria-hidden sx={{ width: 24, height: 2, bgcolor: '#A07E33' }} />
          <Typography variant="overline" sx={{ color: 'secondary.dark', letterSpacing: '.14em' }}>Thoughtfully built for giving</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, borderRadius: '8px 28px 8px 28px', bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)', overflow: 'hidden', p: { xs: 1, md: 1.5 } }}>
          {stats.map((stat, index) => {
            const item = foundations[stat.value as keyof typeof foundations]
            const Icon = item?.icon ?? VerifiedUserRoundedIcon
            return (
              <Box key={stat.label} sx={{ p: { xs: 2.5, md: 3 }, minWidth: 0, position: 'relative', '&::after': { content: '""', position: 'absolute', bgcolor: 'divider', left: { xs: 20, sm: 'auto' }, right: { xs: 20, sm: 0 }, bottom: { xs: 0, sm: 24 }, top: { xs: 'auto', sm: 24 }, height: { xs: '1px', sm: 'auto' }, width: { xs: 'auto', sm: '1px' }, display: index === stats.length - 1 ? 'none' : { xs: 'block', sm: index % 2 === 0 ? 'block' : 'none', lg: 'block' } } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box aria-hidden sx={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '6px 14px 6px 14px', boxShadow: 'var(--neu-inset)', color: index % 2 === 0 ? 'primary.main' : '#A07E33' }}><Icon sx={{ fontSize: 21 }} /></Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, lineHeight: 1.4 }}>{item?.label ?? stat.label}</Typography>
                </Box>
                <Typography component="h3" sx={{ fontSize: '1.05rem', fontWeight: 700, mb: 1, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{item?.title ?? stat.value}</Typography>
                {item && <Typography variant="body2" sx={{ fontSize: '.82rem', color: 'text.secondary', lineHeight: 1.7 }}>{item.detail}</Typography>}
              </Box>
            )
          })}
        </Box>
      </Container>
    </Box>
  )
}

export default StatsSection
