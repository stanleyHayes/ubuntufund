import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import Avatar from '@mui/material/Avatar'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import BusinessRounded from '@mui/icons-material/BusinessRounded'
import { Link as RouterLink } from 'react-router-dom'
import { CampaignGrid } from '@/components/campaigns/CampaignGrid'
import { StartCampaignBanner } from '@/components/campaigns/StartCampaignBanner'
import { GlobalActivityFeed } from '@/components/GlobalActivityFeed'
import { SHAPE, breadcrumbList } from '@ubuntu-fund/ui'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { useFeaturedDonors } from '@/hooks/useLeaderboard'

const HOME_CAMPAIGN_LIMIT = 6

function FeaturedDonorCard({ entry, index }: {
  entry: { name: string; avatarUrl?: string; totalDonated: number; donationCount?: number; userRole?: string; currency?: string }
  index: number
}) {
  const first = index === 0
  const currency = entry.currency === 'GHS' || !entry.currency ? 'GH₵' : entry.currency
  return (
    <Box component="li" sx={{ minWidth: 0, listStyle: 'none', p: first ? { xs: 2, sm: 2.5 } : 2, borderRadius: SHAPE.sm, bgcolor: 'background.paper', boxShadow: first ? 'var(--neu-raised)' : 'none', borderBottom: first ? 0 : '1px solid', borderColor: 'divider' }}>
      {first && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-warning)', mb: 2 }}><EmojiEventsRounded sx={{ fontSize: 20 }} /><Typography variant="overline">01 · Leading the way</Typography></Box>}
      <Box sx={{ display: 'grid', gridTemplateColumns: first ? '48px minmax(0, 1fr)' : '22px 32px minmax(0, 1fr)', alignItems: 'center', gap: 1.25 }}>
        {!first && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</Typography>}
        <Avatar src={entry.avatarUrl} alt="" sx={{ width: first ? 48 : 32, height: first ? 48 : 32, bgcolor: 'action.hover', color: first ? 'var(--text-warning)' : 'primary.main', fontSize: first ? '1.1rem' : '0.8rem' }}>{entry.name.charAt(0).toUpperCase()}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: first ? '1.15rem' : '0.92rem', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{entry.name}{entry.userRole === 'organization' && <BusinessRounded aria-label="Organization" sx={{ fontSize: 15, color: 'info.main', ml: 0.75, verticalAlign: 'middle' }} />}</Typography>
          {!first && <Typography sx={{ mt: 0.5, fontWeight: 700, color: 'primary.main', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}><Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{currency} </Box>{entry.totalDonated.toLocaleString()}</Typography>}
          {!first && entry.donationCount != null && <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{entry.donationCount} contribution{entry.donationCount !== 1 ? 's' : ''}</Typography>}
        </Box>
      </Box>
      {first && <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>Total contributed · {currency}</Typography>
        <Typography sx={{ fontSize: { xs: '2rem', sm: '2.4rem' }, lineHeight: 1.15, fontWeight: 900, letterSpacing: '-0.035em', color: 'var(--text-warning)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{entry.totalDonated.toLocaleString()}</Typography>
        {entry.donationCount != null && <Typography sx={{ mt: 0.75, fontSize: '0.8rem', color: 'text.secondary' }}>{entry.donationCount} contribution{entry.donationCount !== 1 ? 's' : ''}</Typography>}
      </Box>}
    </Box>
  )
}

function FeaturedDonorsSection() {
  const { featured, isLoading } = useFeaturedDonors('all', 5)

  const hasAllTime = featured.topAllTime.length > 0
  const hasMonthly = featured.topThisMonth.length > 0

  if (!isLoading && !hasAllTime && !hasMonthly) return null

  return (
    <Container id="top-donors" maxWidth="lg" sx={{ py: { xs: 7, md: 10 }, scrollMarginTop: 90 }}>
      <Box sx={{ textAlign: { xs: 'left', md: 'center' }, mb: 5 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <EmojiEventsRounded sx={{ fontSize: 32, color: '#C7A24A' }} />
          <Typography variant="h2" component="h2" sx={{ fontWeight: 800 }}>
            Top Donors
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
          A live record of the people and organizations consistently backing community work.
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
          {[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={480} sx={{ borderRadius: SHAPE.card }} />)}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: hasAllTime && hasMonthly ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }, gap: 3, maxWidth: 1100, mx: 'auto', alignItems: 'start' }}>
          {/* Render a podium section */}
          {[
            { entries: featured.topAllTime, label: 'All-Time Leaders', icon: <TrendingUpRounded sx={{ color: '#C7A24A', fontSize: 24 }} /> },
            { entries: featured.topThisMonth, label: "This Month's Stars", icon: <EmojiEventsRounded sx={{ color: '#A7654A', fontSize: 24 }} /> },
          ]
            .filter((s) => s.entries.length > 0)
            .map((section) => (
              <Box component="section" aria-label={section.label} key={section.label} sx={{ minWidth: 0, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card, p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  {section.icon}
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                    {section.label}
                  </Typography>
                </Box>

                <Box component="ol" sx={{ display: 'grid', gap: 1, m: 0, p: 0, minWidth: 0, listStyle: 'none' }}>
                  {section.entries.slice(0, 5).map((entry, index) => <FeaturedDonorCard key={entry.userId} entry={entry} index={index} />)}
                </Box>
              </Box>
            ))}
        </Box>
      )}

      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          component={RouterLink}
          to="/leaderboard"
          variant="outlined"
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{ px: 4, borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 600 }}
        >
          View Full Leaderboard
        </Button>
      </Box>
    </Container>
  )
}

export function HomePage() {
  const { campaigns, isLoading } = useCampaigns()

  useSeo({
    title: 'Ujimora — fundraise and give in Ghana',
    description:
      'Raise money for what matters in Ghana and support campaigns you trust. Give by mobile money or card in seconds, and follow every cedi to where it lands.',
    path: '/',
    jsonLd: breadcrumbList(SITE_ORIGIN, [{ name: 'Home' }]),
  })

  return (
    <>
      <StartCampaignBanner />

      {/* Featured Donors */}
      <FeaturedDonorsSection />

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, scrollMarginTop: 88 }} id="campaigns">
        <Box component="section" aria-labelledby="home-campaigns-heading">
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'flex-end' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, mb: 4 }}>
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="overline" color="text.secondary">Find a cause</Typography>
              <Typography id="home-campaigns-heading" variant="h2" component="h2" sx={{ mt: 0.75, mb: 1 }}>A little support. A lasting impact.</Typography>
              <Typography color="text.secondary">Discover campaigns across Ghana and choose where you can make a difference.</Typography>
            </Box>
            <Button component={RouterLink} to="/explore" variant="outlined" endIcon={<ArrowForwardRoundedIcon />} sx={{ flexShrink: 0 }}>Explore all campaigns</Button>
          </Box>
          {isLoading ? (
            <Grid container spacing={3}>
              {Array.from({ length: HOME_CAMPAIGN_LIMIT }, (_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Skeleton variant="rounded" height={380} sx={{ borderRadius: SHAPE.card }} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <CampaignGrid campaigns={campaigns.slice(0, HOME_CAMPAIGN_LIMIT)} />
          )}
        </Box>
        <Box component="section" id="community-activity" aria-label="Community activity" sx={{ mt: { xs: 6, md: 8 }, scrollMarginTop: 96 }}>
          <GlobalActivityFeed compact />
        </Box>
      </Container>
    </>
  )
}
