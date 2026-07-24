import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import BusinessRounded from '@mui/icons-material/BusinessRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import MilitaryTechRounded from '@mui/icons-material/MilitaryTechRounded'
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded'
import { keyframes } from '@emotion/react'
import { Link as RouterLink } from 'react-router-dom'
import { CampaignGrid } from '@/components/campaigns/CampaignGrid'
import { StartCampaignBanner } from '@/components/campaigns/StartCampaignBanner'
import { GlobalActivityFeed } from '@/components/GlobalActivityFeed'
import { SHAPE } from '@ubuntu-fund/ui'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useFeaturedDonors } from '@/hooks/useLeaderboard'

const HOME_CAMPAIGN_LIMIT = 6

const floatUp = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`

const RANK_CONFIG = [
  { color: '#C7A24A', bg: '#FFF8E1', glow: 'rgba(199,162,74,0.3)', icon: <EmojiEventsRounded />, label: '1st' },
  { color: '#B0BEC5', bg: '#ECEFF1', glow: 'rgba(176,190,197,0.25)', icon: <MilitaryTechRounded />, label: '2nd' },
  { color: '#CD7F32', bg: '#EFEBE9', glow: 'rgba(205,127,50,0.25)', icon: <WorkspacePremiumRounded />, label: '3rd' },
  { color: '#78909C', bg: '#FAFAFA', glow: 'rgba(0,0,0,0.06)', icon: <StarRounded />, label: '4th' },
  { color: '#78909C', bg: '#FAFAFA', glow: 'rgba(0,0,0,0.06)', icon: <StarRounded />, label: '5th' },
]

function FeaturedDonorCard({
  entry,
  index,
}: {
  entry: { name: string; avatarUrl?: string; totalDonated: number; donationCount?: number; userRole?: string; currency?: string }
  index: number
}) {
  const rank = RANK_CONFIG[index] ?? RANK_CONFIG[4]
  const isTop3 = index < 3
  const isFirst = index === 0
  const avatarSize = isFirst ? 80 : isTop3 ? 64 : 52

  return (
    <Card
      elevation={0}
      sx={{
        textAlign: 'center',
        position: 'relative',
        overflow: 'visible',
        borderRadius: SHAPE.card,
        border: isTop3 ? `2.5px solid ${rank.color}` : '1px solid rgba(0,0,0,0.08)',
        bgcolor: isFirst ? rank.bg : '#fff',
        animation: isFirst ? `${floatUp} 3s ease-in-out infinite` : undefined,
        mt: isFirst ? 0 : index === 1 || index === 2 ? 4 : 6,
      }}
    >
      {/* Rank badge */}
      <Box
        sx={{
          position: 'absolute',
          top: -16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: rank.color,
          color: isTop3 ? '#fff' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& .MuiSvgIcon-root': { fontSize: 18 },
        }}
      >
        {rank.icon}
      </Box>

      <CardContent sx={{ pt: 4, pb: 2.5, px: isFirst ? 3 : 2 }}>
        {/* Avatar with ring */}
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 1.5 }}>
          <Avatar
            src={entry.avatarUrl}
            alt={entry.name}
            sx={{
              width: avatarSize,
              height: avatarSize,
              mx: 'auto',
              border: `3px solid ${rank.color}`,
              boxShadow: isTop3 ? `0 0 0 4px ${rank.glow}` : 'none',
            }}
          />
          {isFirst && (
            <Box
              sx={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: '#C7A24A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
              }}
            >
              <StarRounded sx={{ fontSize: 14, color: '#fff' }} />
            </Box>
          )}
        </Box>

        {/* Name */}
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: isFirst ? '1.05rem' : '0.88rem',
            fontFamily: '"Outfit", sans-serif',
            mb: 0.25,
            ...(isFirst && {
              color: '#B8860B',
            }),
          }}
        >
          {entry.name}
        </Typography>

        {entry.userRole === 'organization' && (
          <Chip
            icon={<BusinessRounded sx={{ fontSize: '11px !important' }} />}
            label="Organization"
            size="small"
            sx={{ mb: 0.5, fontSize: '0.6rem', fontWeight: 700, height: 20, bgcolor: 'rgba(74,107,117,0.1)', color: '#4A6B75' }}
          />
        )}

        {/* Amount */}
        <Typography sx={{ fontWeight: 800, fontSize: isFirst ? '1.2rem' : '0.95rem', color: '#2E3D2F', fontFamily: '"Outfit", sans-serif' }}>
          ${entry.totalDonated.toLocaleString()}
        </Typography>

        {entry.donationCount != null && (
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
            {entry.donationCount} donation{entry.donationCount !== 1 ? 's' : ''}
          </Typography>
        )}

        {/* Rank label */}
        <Chip
          label={rank.label}
          size="small"
          sx={{
            mt: 1,
            fontSize: '0.62rem',
            fontWeight: 800,
            height: 20,
            bgcolor: `${rank.color}18`,
            color: rank.color === '#78909C' ? '#555' : rank.color,
            letterSpacing: '0.04em',
          }}
        />
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
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <EmojiEventsRounded sx={{ fontSize: 32, color: '#C7A24A' }} />
          <Typography variant="h2" component="h2" sx={{ fontWeight: 800 }}>
            Top Donors
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
          Celebrating the people and organizations making the biggest impact on our platform.
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" width={i === 0 ? 200 : 160} height={i === 0 ? 260 : 220} sx={{ borderRadius: SHAPE.card }} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Render a podium section */}
          {[
            { entries: featured.topAllTime, label: 'All-Time Leaders', icon: <TrendingUpRounded sx={{ color: '#C7A24A', fontSize: 24 }} /> },
            { entries: featured.topThisMonth, label: "This Month's Stars", icon: <EmojiEventsRounded sx={{ color: '#AB47BC', fontSize: 24 }} /> },
          ]
            .filter((s) => s.entries.length > 0)
            .map((section) => (
              <Box key={section.label}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 4 }}>
                  {section.icon}
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                    {section.label}
                  </Typography>
                </Box>

                {/* Podium layout: 2nd | 1st (elevated) | 3rd — then 4th, 5th below */}
                {section.entries.length >= 3 ? (
                  <Box sx={{ maxWidth: 900, mx: 'auto' }}>
                    {/* Top 3 podium */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1.3fr 1fr' },
                        gap: { xs: 2, sm: 3 },
                        alignItems: 'end',
                        mb: section.entries.length > 3 ? 3 : 0,
                      }}
                    >
                      {/* 2nd place */}
                      <Box sx={{ order: { xs: 1, sm: 0 } }}>
                        <FeaturedDonorCard entry={section.entries[1]} index={1} />
                      </Box>
                      {/* 1st place (elevated) */}
                      <Box sx={{ order: { xs: 0, sm: 1 } }}>
                        <FeaturedDonorCard entry={section.entries[0]} index={0} />
                      </Box>
                      {/* 3rd place */}
                      <Box sx={{ order: 2 }}>
                        <FeaturedDonorCard entry={section.entries[2]} index={2} />
                      </Box>
                    </Box>

                    {/* 4th, 5th runners up */}
                    {section.entries.length > 3 && (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(section.entries.length - 3, 2)}, 1fr)` },
                          gap: 2,
                          maxWidth: 480,
                          mx: 'auto',
                        }}
                      >
                        {section.entries.slice(3, 5).map((e, i) => (
                          <FeaturedDonorCard key={e.userId} entry={e} index={i + 3} />
                        ))}
                      </Box>
                    )}
                  </Box>
                ) : (
                  /* Fewer than 3 — simple row */
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
                    {section.entries.map((e, i) => (
                      <Box key={e.userId} sx={{ width: 200 }}>
                        <FeaturedDonorCard entry={e} index={i} />
                      </Box>
                    ))}
                  </Box>
                )}
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
                    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: SHAPE.card }}>
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
