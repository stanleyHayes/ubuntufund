import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import { Link as RouterLink } from 'react-router-dom'
import { formatCurrency, SHAPE, EmptyState } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useMyDonations, type UserDonation } from '@/hooks/useDonations'
import type { Campaign } from '@ubuntu-fund/types'
import { keyframes } from '@emotion/react'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const countSlide = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`


const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  medical: <LocalHospitalRoundedIcon sx={{ fontSize: 14 }} />,
  education: <SchoolRoundedIcon sx={{ fontSize: 14 }} />,
  emergency: <WarningAmberRoundedIcon sx={{ fontSize: 14 }} />,
  business: <BusinessCenterRoundedIcon sx={{ fontSize: 14 }} />,
  community: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
  religious: <AccountBalanceRoundedIcon sx={{ fontSize: 14 }} />,
  creative: <PaletteRoundedIcon sx={{ fontSize: 14 }} />,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysLeft(end: Date) {
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000)
  if (diff <= 0) return 'Ended'
  if (diff === 1) return '1 day'
  return `${diff} days`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  label: string
  value: string
  change?: string
  changePositive?: boolean
  delay: number
}

function StatCard({ icon, iconBg, iconColor, label, value, change, changePositive = true, delay }: StatCardProps) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
        animation: `${fadeInUp} 0.5s ${delay}s ease both`,
        '&:hover': {
          borderColor: `${iconColor}30`,
          boxShadow: `0 8px 24px ${iconColor}12`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: SHAPE.sm,
            bgcolor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
          }}
        >
          {icon}
        </Box>
        {change && (
          <Chip
            label={change}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 700,
              bgcolor: changePositive ? 'rgba(46, 61, 47,0.08)' : 'rgba(239,83,80,0.08)',
              color: changePositive ? '#2E3D2F' : '#E53935',
              '& .MuiChip-label': { px: 1 },
            }}
          />
        )}
      </Box>
      <Typography
        sx={{
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 900,
          fontSize: '1.65rem',
          color: 'text.primary',
          lineHeight: 1,
          mb: 0.5,
          animation: `${countSlide} 0.4s ${delay + 0.15}s ease both`,
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Campaign Row Card
// ---------------------------------------------------------------------------

function CampaignRow({ campaign, index }: { campaign: Campaign; index: number }) {
  const [hovered, setHovered] = useState(false)
  const pct = Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
  const funded = campaign.raisedAmount >= campaign.goalAmount
  const isUrgent = campaign.priority === 'urgent' || campaign.priority === 'critical'

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: hovered ? 'primary.light' : 'rgba(0,0,0,0.06)',
        transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)',
        animation: `${fadeInUp} 0.5s ${0.1 * index + 0.3}s ease both`,
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(46, 61, 47,0.08)' : 'none',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{CATEGORY_ICONS[campaign.category] ?? null} {campaign.category.charAt(0).toUpperCase() + campaign.category.slice(1)}</Box>}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.72rem',
                fontWeight: 600,
                bgcolor: 'rgba(46, 61, 47,0.06)',
                color: 'primary.dark',
              }}
            />
            {isUrgent && (
              <Chip
                label={campaign.priority === 'critical' ? 'Critical' : 'Urgent'}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  bgcolor: campaign.priority === 'critical' ? 'rgba(239,83,80,0.1)' : 'rgba(255,167,38,0.1)',
                  color: campaign.priority === 'critical' ? '#E53935' : '#E65100',
                }}
              />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
              <CalendarTodayRoundedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                {daysLeft(campaign.endDate)} left
              </Typography>
            </Box>
          </Box>

          <Typography
            component={RouterLink}
            to={`/campaigns/${campaign.id}`}
            sx={{
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'text.primary',
              textDecoration: 'none',
              display: 'block',
              mb: 0.5,
              '&:hover': { color: 'primary.main' },
              transition: 'color 0.2s ease',
            }}
          >
            {campaign.title}
          </Typography>

          <Typography
            sx={{
              fontSize: '0.82rem',
              color: 'text.secondary',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {campaign.description}
          </Typography>
        </Box>

        <Tooltip title="More options">
          <IconButton size="small" sx={{ ml: 1, color: 'text.disabled' }}>
            <MoreHorizRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Progress section */}
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'primary.dark' }}>
              {formatCurrency(campaign.raisedAmount, campaign.currency)}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              of {formatCurrency(campaign.goalAmount, campaign.currency)}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: '"Outfit", monospace',
              fontWeight: 800,
              fontSize: '0.85rem',
              color: funded ? 'success.main' : 'primary.main',
            }}
          >
            {pct}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6,
            borderRadius: SHAPE.bar,
            bgcolor: 'rgba(0,0,0,0.04)',
            '& .MuiLinearProgress-bar': {
              borderRadius: SHAPE.bar,
              bgcolor: '#2E3D2F',
            },
          }}
        />
      </Box>

      {/* Bottom row: donors + action */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AvatarGroup
            max={3}
            sx={{
              '& .MuiAvatar-root': {
                width: 24,
                height: 24,
                fontSize: '0.6rem',
                border: '2px solid #fff',
                bgcolor: 'primary.main',
              },
            }}
          >
            <Avatar>K</Avatar>
            <Avatar>F</Avatar>
            <Avatar>T</Avatar>
            <Avatar>+</Avatar>
          </AvatarGroup>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
            147 supporters
          </Typography>
        </Box>

        <Button
          component={RouterLink}
          to={`/campaigns/${campaign.id}`}
          size="small"
          endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '14px !important' }} />}
          sx={{
            fontSize: '0.78rem',
            fontWeight: 600,
            textTransform: 'none',
            color: 'primary.main',
            '&:hover': { bgcolor: 'rgba(46, 61, 47,0.06)' },
          }}
        >
          View Details
        </Button>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Donation Activity Feed
// ---------------------------------------------------------------------------

function DonationFeed({ donations }: { donations: UserDonation[] }) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        border: '1px solid rgba(0,0,0,0.06)',
        height: '100%',
        animation: `${fadeInUp} 0.5s 0.4s ease both`,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          Recent Donations
        </Typography>
        <Chip
          label="Live"
          size="small"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: 'rgba(46, 61, 47,0.08)',
            color: '#2E3D2F',
            '& .MuiChip-label': { px: 1 },
            '&::before': {
              content: '""',
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#2E3D2F',
              display: 'inline-block',
              mr: 0.5,
              opacity: 0.8,
            },
          }}
        />
      </Box>

      {donations.length === 0 ? (
        <EmptyState variant="noData" compact title="No donations yet" description="Your recent donations will appear here." />
      ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {donations.map((d, i) => (
          <Box
            key={d.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1.5,
              borderBottom: i < donations.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              animation: `${fadeInUp} 0.3s ${0.05 * i + 0.5}s ease both`,
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: 'rgba(46, 61, 47,0.1)',
                color: '#2E3D2F',
              }}
            >
              {d.campaignName?.[0] ?? 'D'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'text.primary',
                  }}
                >
                  {d.campaignName}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: '"Outfit", monospace',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: 'primary.dark',
                    flexShrink: 0,
                    ml: 1,
                  }}
                >
                  {formatCurrency(d.amount, d.currency)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                {d.status} &middot; {d.date}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Quick Actions Panel
// ---------------------------------------------------------------------------

function QuickActions() {
  const actions = [
    { icon: <AddRoundedIcon />, label: 'New Campaign', to: '/campaigns/new', color: '#2E3D2F', bg: 'rgba(46, 61, 47,0.08)' },
    { icon: <PeopleRoundedIcon />, label: 'Invite Friends', to: '#', color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
    { icon: <VolunteerActivismRoundedIcon />, label: 'My Donations', to: '#', color: '#AD1457', bg: 'rgba(173,20,87,0.08)' },
  ]

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        border: '1px solid rgba(0,0,0,0.06)',
        animation: `${fadeInUp} 0.5s 0.5s ease both`,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 2 }}>
        Quick Actions
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {actions.map((a) => (
          <Button
            key={a.label}
            component={RouterLink}
            to={a.to}
            fullWidth
            startIcon={
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: SHAPE.sm,
                  bgcolor: a.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: a.color,
                  '& svg': { fontSize: '1rem' },
                }}
              >
                {a.icon}
              </Box>
            }
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: 'text.primary',
              py: 1,
              px: 1.5,
              borderRadius: SHAPE.sm,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
            }}
          >
            {a.label}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { user } = useAuth()
  const displayName = user?.name?.split(' ')[0] ?? 'there'
  const { campaigns, isLoading: campaignsLoading } = useCampaigns()
  const { donations, isLoading: donationsLoading } = useMyDonations()
  const recentDonations = donations.slice(0, 5)

  return (
    <Box sx={{ bgcolor: '#F2EFEA', minHeight: '100vh' }}>
      {/* Hero header */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          pt: { xs: 4, md: 5 },
          pb: { xs: 5, md: 6 },
          bgcolor: '#0D1F0D',
        }}
      >
        {/* Subtle dot pattern */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
              animation: `${fadeInUp} 0.5s ease both`,
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 900,
                  fontSize: { xs: '1.6rem', md: '2rem' },
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                  mb: 0.5,
                }}
              >
                {getGreeting()},{' '}
                <Box component="span" sx={{ color: '#5E8F72' }}>
                  {displayName}
                </Box>
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                Here&apos;s how your campaigns are doing today
              </Typography>
            </Box>

            <Button
              component={RouterLink}
              to="/campaigns/new"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{
                borderRadius: SHAPE.sm,
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
                textTransform: 'none',
                px: 3,
                py: 1.2,
                background: 'linear-gradient(135deg, #5E8F72, #2E3D2F)',
                boxShadow: '0 4px 16px rgba(76,175,80,0.3)',
                '&:hover': {
                  boxShadow: '0 6px 24px rgba(76,175,80,0.4)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.25s ease',
              }}
            >
              New Campaign
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -3, pb: 6, position: 'relative', zIndex: 2 }}>
        {/* Stats row */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<TrendingUpRoundedIcon sx={{ fontSize: 22 }} />}
              iconBg="rgba(46, 61, 47,0.08)"
              iconColor="#2E3D2F"
              label="Total Raised"
              value={formatCurrency(campaigns.reduce((s, c) => s + c.raisedAmount, 0), 'GHS')}
              delay={0.05}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<CampaignRoundedIcon sx={{ fontSize: 22 }} />}
              iconBg="rgba(21,101,192,0.08)"
              iconColor="#1565C0"
              label="Active Campaigns"
              value={String(campaigns.filter((c) => c.status === 'active').length)}
              delay={0.1}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<VolunteerActivismRoundedIcon sx={{ fontSize: 22 }} />}
              iconBg="rgba(199, 162, 74,0.08)"
              iconColor="#A07E33"
              label="Donations Received"
              value={String(donations.length)}
              delay={0.15}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<PeopleRoundedIcon sx={{ fontSize: 22 }} />}
              iconBg="rgba(106,27,154,0.08)"
              iconColor="#6A1B9A"
              label="Campaigns Supported"
              value={String(new Set(donations.map((d) => d.campaignId)).size)}
              delay={0.2}
            />
          </Grid>
        </Grid>

        {/* Main content grid */}
        <Grid container spacing={3}>
          {/* Left: Campaigns */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                }}
              >
                My Campaigns
              </Typography>
              <Button
                component={RouterLink}
                to="/my-campaigns"
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                }}
              >
                View all
              </Button>
            </Box>

            {campaigns.length === 0 ? (
              <EmptyState
                variant="empty"
                compact
                title="No campaigns yet"
                description="Start making a difference — create your first campaign and rally your community."
                action={
                  <Button
                    component={RouterLink}
                    to="/campaigns/new"
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3 }}
                  >
                    Create a Campaign
                  </Button>
                }
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {campaigns.map((campaign, i) => (
                  <CampaignRow key={campaign.id} campaign={campaign} index={i} />
                ))}
              </Box>
            )}
          </Grid>

          {/* Right: Sidebar */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <DonationFeed donations={recentDonations} />
              <QuickActions />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
