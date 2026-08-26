import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import BusinessRounded from '@mui/icons-material/BusinessRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import MilitaryTechRounded from '@mui/icons-material/MilitaryTechRounded'
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded'
import { Link as RouterLink } from 'react-router-dom'
import { CampaignGrid } from '@/components/campaigns/CampaignGrid'
import { StartCampaignBanner } from '@/components/campaigns/StartCampaignBanner'
import { GlobalActivityFeed } from '@/components/GlobalActivityFeed'
import { SHAPE } from '@ubuntu-fund/ui'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useFeaturedDonors } from '@/hooks/useLeaderboard'

const HOME_CAMPAIGN_LIMIT = 6

const RANK_CONFIG = [
  { color: '#A07E33', icon: <EmojiEventsRounded />, label: '01' },
  { color: '#74909A', icon: <MilitaryTechRounded />, label: '02' },
  { color: '#B66A36', icon: <WorkspacePremiumRounded />, label: '03' },
  { color: '#5E8F72', icon: <StarRounded />, label: '04' },
  { color: '#5E8F72', icon: <StarRounded />, label: '05' },
]

function FeaturedDonorCard({
  entry,
  index,
}: {
  entry: { name: string; avatarUrl?: string; totalDonated: number; donationCount?: number; userRole?: string; currency?: string }
  index: number
}) {
  const rank = RANK_CONFIG[index] ?? RANK_CONFIG[4]
  const isFirst = index === 0
  const avatarSize = isFirst ? 74 : 48

  return (
    <Card
      elevation={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: SHAPE.card,
        bgcolor: 'var(--neu-surface)',
        color: 'text.primary',
        boxShadow: isFirst ? 'var(--neu-raised)' : 'var(--neu-subtle)',
        minHeight: isFirst ? 156 : 78,
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 'var(--neu-raised-hover)' },
      }}
    >
      <Box
        sx={{
          width: isFirst ? 60 : 44, height: isFirst ? 60 : 44, ml: isFirst ? 2.5 : 1.5, flexShrink: 0,
          borderRadius: SHAPE.sm, bgcolor: 'var(--neu-surface)', color: rank.color,
          display: 'grid', placeItems: 'center',
          boxShadow: 'var(--neu-subtle)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ '& svg': { fontSize: isFirst ? 24 : 18 } }}>{rank.icon}</Box>
          <Typography sx={{ mt: 0.35, fontWeight: 900, fontSize: '0.68rem', letterSpacing: '.08em' }}>{rank.label}</Typography>
        </Box>
      </Box>

      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: isFirst ? 2.5 : 1.5, py: isFirst ? 3 : 1.5, px: isFirst ? 3 : 2, flex: 1, minWidth: 0 }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={entry.avatarUrl}
            alt={entry.name}
            sx={{
              width: avatarSize,
              height: avatarSize,
              bgcolor: 'var(--neu-surface)',
              color: rank.color,
              boxShadow: 'var(--neu-subtle)',
            }}
          />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, fontSize: isFirst ? '1.2rem' : '.9rem', lineHeight: 1.15, color: 'text.primary' }}>{entry.name}</Typography>
            {entry.userRole === 'organization' && <BusinessRounded sx={{ fontSize: 15, color: 'info.main' }} />}
          </Box>
          <Typography sx={{ mt: .5, fontWeight: 900, fontSize: isFirst ? '1.7rem' : '.92rem', color: isFirst ? 'secondary.dark' : 'primary.main', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {entry.currency ?? 'GH₵'} {entry.totalDonated.toLocaleString()}
          </Typography>
          {entry.donationCount != null && <Typography sx={{ fontSize: '.72rem', color: 'text.secondary' }}>{entry.donationCount} contribution{entry.donationCount !== 1 ? 's' : ''}</Typography>}
        </Box>
      </CardContent>
    </Card>
  )
}

function FeaturedDonorsSection() {
  const { featured, isLoading } = useFeaturedDonors('all', 5)

  const hasAllTime = featured.topAllTime.length > 0
  const hasMonthly = featured.topThisMonth.length > 0

  if (!isLoading && !hasAllTime && !hasMonthly) return null

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" width={i === 0 ? 200 : 160} height={i === 0 ? 260 : 220} sx={{ borderRadius: SHAPE.card }} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 980, mx: 'auto' }}>
          {/* Render a podium section */}
          {[
            { entries: featured.topAllTime, label: 'All-Time Leaders', icon: <TrendingUpRounded sx={{ color: '#C7A24A', fontSize: 24 }} /> },
            { entries: featured.topThisMonth, label: "This Month's Stars", icon: <EmojiEventsRounded sx={{ color: '#A7654A', fontSize: 24 }} /> },
          ]
            .filter((s) => s.entries.length > 0)
            .map((section) => (
              <Box key={section.label} sx={{ bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card, p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  {section.icon}
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                    {section.label}
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: section.entries.length > 1 ? '1.3fr .7fr' : '1fr' }, gap: 2, alignItems: 'stretch' }}>
                  <FeaturedDonorCard entry={section.entries[0]} index={0} />
                  {section.entries.length > 1 && <Box sx={{ display: 'grid', gap: 1.25 }}>{section.entries.slice(1, 5).map((e, i) => <FeaturedDonorCard key={e.userId} entry={e} index={i + 1} />)}</Box>}
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

  return (
    <>
      <StartCampaignBanner />

      {/* Featured Donors */}
      <FeaturedDonorsSection />

      {/* Campaigns + Global Activity */}
      <Container maxWidth="lg" sx={{ py: 8 }} id="campaigns">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              <Typography variant="h2" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
                Campaigns
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
                Discover verified campaigns across Ghana. Every contribution builds trust and transforms communities.
              </Typography>
            </Box>

            {isLoading ? (
              <Grid container spacing={3}>
                {[0, 1, 2].map((i) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                    <Card elevation={0} sx={{ borderRadius: SHAPE.card }}>
                      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: SHAPE.card }} />
                      <CardContent>
                        <Skeleton width="40%" height={24} sx={{ mb: 1 }} />
                        <Skeleton width="85%" height={20} sx={{ mb: 0.5 }} />
                        <Skeleton width="70%" height={20} sx={{ mb: 2 }} />
                        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: SHAPE.bar, mb: 1.5 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Skeleton width="30%" height={16} />
                          <Skeleton width="25%" height={16} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <>
                <CampaignGrid campaigns={campaigns.slice(0, HOME_CAMPAIGN_LIMIT)} featuredCount={2} />
                {campaigns.length > HOME_CAMPAIGN_LIMIT && (
                  <Box sx={{ textAlign: 'center', mt: 5 }}>
                    <Button
                      component={RouterLink}
                      to="/explore"
                      variant="outlined"
                      size="large"
                      endIcon={<ArrowForwardRoundedIcon />}
                      sx={{ px: 4, borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 600 }}
                    >
                      View All Campaigns
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Box sx={{ position: 'sticky', top: 24 }}>
              <GlobalActivityFeed compact />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </>
  )
}
