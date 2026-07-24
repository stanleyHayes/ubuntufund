import { useState, useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import VolunteerActivismRounded from '@mui/icons-material/VolunteerActivismRounded'
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded'
import ExploreRounded from '@mui/icons-material/ExploreRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded'
import FavoriteRounded from '@mui/icons-material/FavoriteRounded'
import DiamondRounded from '@mui/icons-material/DiamondRounded'
import MilitaryTechRounded from '@mui/icons-material/MilitaryTechRounded'
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded'
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded'
import DateRangeRounded from '@mui/icons-material/DateRangeRounded'
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded'
import AllInclusiveRounded from '@mui/icons-material/AllInclusiveRounded'
import PeopleRounded from '@mui/icons-material/PeopleRounded'
import BusinessRounded from '@mui/icons-material/BusinessRounded'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import { keyframes } from '@mui/material/styles'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import type { LeaderboardEntry, Period, Category } from '@/hooks/useLeaderboard'

const RANK_COLORS = ['#C7A24A', '#C0C0C0', '#CD7F32']

type SortMode = 'donations' | 'amount'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
`

const floatSlow = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(5deg); }
`

const sparkle = keyframes`
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
`

// ─── Badge System ────────────────────────────────────────────────────────────

interface Badge {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  color: string
  bgSolid: string
  rarity: 'legendary' | 'epic' | 'rare' | 'common'
}

const PIONEER_BADGES: Badge[] = [
  {
    id: 'first-campaign',
    name: 'Trailblazer',
    description: 'Started the very first campaign on Ubuntu Fund',
    icon: <RocketLaunchRounded />,
    color: '#C7A24A',
    bgSolid: '#FFA000',
    rarity: 'legendary',
  },
  {
    id: 'first-donor',
    name: 'Genesis Donor',
    description: 'The very first person to donate on the platform',
    icon: <AutoAwesomeRounded />,
    color: '#E040FB',
    bgSolid: '#7C4DFF',
    rarity: 'legendary',
  },
  {
    id: 'first-campaign-donor',
    name: 'Early Believer',
    description: 'First donor to a campaign — believed before anyone else',
    icon: <StarRounded />,
    color: '#00E5FF',
    bgSolid: '#2979FF',
    rarity: 'epic',
  },
]

const DONATION_LEVEL_BADGES: Badge[] = [
  {
    id: 'supporter',
    name: 'Supporter',
    description: '5+ donations made',
    icon: <FavoriteRounded />,
    color: '#2F6B46',
    bgSolid: '#2F6B46',
    rarity: 'common',
  },
  {
    id: 'champion',
    name: 'Champion',
    description: '25+ donations or GH₵ 500+ donated',
    icon: <WorkspacePremiumRounded />,
    color: '#4A6B75',
    bgSolid: '#1E88E5',
    rarity: 'rare',
  },
  {
    id: 'hero',
    name: 'Hero',
    description: '100+ donations or GH₵ 2,500+ donated',
    icon: <MilitaryTechRounded />,
    color: '#AB47BC',
    bgSolid: '#8B6F4E',
    rarity: 'epic',
  },
  {
    id: 'legend',
    name: 'Legend',
    description: '500+ donations or GH₵ 10,000+ donated',
    icon: <DiamondRounded />,
    color: '#C7A24A',
    bgSolid: '#FF6F00',
    rarity: 'legendary',
  },
  {
    id: 'streak',
    name: 'On Fire',
    description: 'Donated 7 days in a row',
    icon: <LocalFireDepartmentRounded />,
    color: '#B98A2E',
    bgSolid: '#F44336',
    rarity: 'rare',
  },
]

const RARITY_LABELS: Record<string, { label: string; color: string }> = {
  legendary: { label: 'Legendary', color: '#C7A24A' },
  epic: { label: 'Epic', color: '#AB47BC' },
  rare: { label: 'Rare', color: '#4A6B75' },
  common: { label: 'Common', color: '#2F6B46' },
}

// ─── Period & Category Config ───────────────────────────────────────────────

const PERIOD_OPTIONS: Array<{ key: Period; label: string; icon: React.ReactNode }> = [
  { key: 'daily', label: 'Today', icon: <CalendarTodayRounded sx={{ fontSize: 18 }} /> },
  { key: 'monthly', label: 'This Month', icon: <CalendarMonthRounded sx={{ fontSize: 18 }} /> },
  { key: 'yearly', label: 'This Year', icon: <DateRangeRounded sx={{ fontSize: 18 }} /> },
  { key: 'lifetime', label: 'All Time', icon: <AllInclusiveRounded sx={{ fontSize: 18 }} /> },
]

const CATEGORY_OPTIONS: Array<{ key: Category; label: string; icon: React.ReactNode }> = [
  { key: 'all', label: 'Everyone', icon: <GroupsRounded sx={{ fontSize: 18 }} /> },
  { key: 'user', label: 'People', icon: <PeopleRounded sx={{ fontSize: 18 }} /> },
  { key: 'organization', label: 'Organizations', icon: <BusinessRounded sx={{ fontSize: 18 }} /> },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSorted(entries: LeaderboardEntry[], mode: SortMode): LeaderboardEntry[] {
  return [...entries].sort((a, b) =>
    mode === 'donations' ? (b.donationCount ?? b.campaignsSupported) - (a.donationCount ?? a.campaignsSupported) : b.totalDonated - a.totalDonated,
  )
}

// ─── Toggle Bar Component ───────────────────────────────────────────────────

function ToggleBar<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string; icon: React.ReactNode }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <Box
      role="tablist"
      sx={{
        // Compact horizontal segmented control — fixed track height so the
        // segments can never stretch to an ancestor's height.
        display: 'inline-grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr', // equal-width segments
        alignItems: 'stretch',
        alignSelf: 'center', // never grow vertically inside a flex parent
        height: 48,
        p: '4px',
        borderRadius: '999px',
        bgcolor: 'rgba(168, 181, 160, 0.22)', // sage-tinted track
        border: '1px solid rgba(46, 61, 47, 0.10)',
        fontFamily: '"Outfit", sans-serif',
      }}
    >
      {options.map((tab) => {
        const isActive = value === tab.key
        return (
          <Box
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              px: { xs: 1.75, sm: 2.75 },
              borderRadius: '999px',
              cursor: 'pointer',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '0.8rem', sm: '0.88rem' },
              letterSpacing: '0.01em',
              color: isActive ? '#F2EFEA' : '#4A5A50',
              bgcolor: isActive ? '#2E3D2F' : 'transparent',
              transition: 'color 160ms ease, background-color 160ms ease',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              '& svg': {
                fontSize: 18,
                color: isActive ? '#F2EFEA' : '#5E8F72',
                transition: 'color 160ms ease',
              },
              '&:hover': isActive ? {} : { color: '#2E3D2F', bgcolor: 'rgba(46, 61, 47, 0.06)' },
            }}
          >
            {tab.icon}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{tab.label}</Box>
          </Box>
        )
      })}
    </Box>
  )
}

// ─── Badge Card Component ────────────────────────────────────────────────────

function BadgeCard({ badge, delay = 0 }: { badge: Badge; delay?: number }) {
  const rarity = RARITY_LABELS[badge.rarity]
  return (
    <Tooltip title={badge.description} arrow placement="top">
      <Card
        elevation={0}
        sx={{
          textAlign: 'center',
          border: '1px solid',
          borderColor: `${badge.color}30`,
          borderRadius: 3,
          bgcolor: `${badge.color}06`,
          animation: `${fadeSlideIn} 0.5s ease ${delay}s both`,
          transition: 'border-color 0.2s ease',
          cursor: 'default',
          '&:hover': {
            borderColor: `${badge.color}60`,
          },
        }}
      >
        <CardContent sx={{ py: 2.5, px: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              bgcolor: badge.bgSolid,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1.5,
              color: '#fff',
              '& svg': { fontSize: 26 },
            }}
          >
            {badge.icon}
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', mb: 0.25 }}>
            {badge.name}
          </Typography>
          <Chip
            label={rarity.label}
            size="small"
            sx={{
              fontSize: '0.6rem',
              fontWeight: 800,
              height: 20,
              color: rarity.color,
              bgcolor: `${rarity.color}15`,
              border: '1px solid',
              borderColor: `${rarity.color}30`,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          />
        </CardContent>
      </Card>
    </Tooltip>
  )
}

// ─── Empty State Component ───────────────────────────────────────────────────

function LeaderboardEmptyState() {
  return (
    <Box sx={{ animation: `${fadeSlideIn} 0.5s ease both` }}>
      {/* Hero Empty State */}
      <Box
        sx={{
          textAlign: 'center',
          py: { xs: 6, md: 8 },
          px: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Floating decorative elements */}
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {[
            { top: '10%', left: '8%', delay: '0s', size: 32, color: '#C7A24A' },
            { top: '20%', right: '12%', delay: '1s', size: 24, color: '#E040FB' },
            { bottom: '25%', left: '15%', delay: '2s', size: 20, color: '#4A6B75' },
            { bottom: '15%', right: '8%', delay: '0.5s', size: 28, color: '#2F6B46' },
            { top: '40%', left: '5%', delay: '1.5s', size: 16, color: '#B98A2E' },
            { top: '35%', right: '5%', delay: '2.5s', size: 22, color: '#00E5FF' },
          ].map((star, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                ...star,
                width: star.size,
                height: star.size,
                animation: `${sparkle} 3s ease-in-out ${star.delay} infinite`,
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AutoAwesomeRounded sx={{ fontSize: star.size, color: star.color, opacity: 0.4 }} />
            </Box>
          ))}
        </Box>

        {/* Main trophy illustration */}
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            bgcolor: '#FFF8E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 4,
            animation: `${float} 4s ease-in-out infinite`,
            position: 'relative',
          }}
        >
          <EmojiEventsRounded sx={{ fontSize: 56, color: '#FF8F00' }} />
          <Box sx={{ position: 'absolute', top: -4, right: -4, animation: `${sparkle} 2s ease-in-out 0.5s infinite` }}>
            <AutoAwesomeRounded sx={{ fontSize: 20, color: '#C7A24A' }} />
          </Box>
          <Box sx={{ position: 'absolute', bottom: 4, left: -8, animation: `${sparkle} 2s ease-in-out 1s infinite` }}>
            <AutoAwesomeRounded sx={{ fontSize: 16, color: '#FFA000' }} />
          </Box>
        </Box>

        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            mb: 2,
            color: '#C7A24A',
            fontSize: { xs: '1.8rem', md: '2.4rem' },
          }}
        >
          Be the First Legend
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 520, mx: 'auto', mb: 1, fontSize: '1.05rem', lineHeight: 1.7 }}
        >
          The leaderboard is waiting for its first hero. Start a campaign or make a donation
          and claim your place in Ubuntu Fund history.
        </Typography>

        <Box
          sx={{
            fontSize: '0.85rem',
            color: '#C7A24A',
            fontWeight: 700,
            mb: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
          }}
        >
          <MilitaryTechRounded sx={{ fontSize: 18 }} />
          First movers earn exclusive legendary badges — forever
        </Box>

        {/* CTA Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
          <Button
            component={RouterLink}
            to="/campaigns/new"
            variant="contained"
            size="large"
            startIcon={<RocketLaunchRounded />}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 800,
              fontSize: '1rem',
              textTransform: 'none',
              bgcolor: '#C7A24A',
              '&:hover': {
                bgcolor: '#A07E33',
              },
              transition: 'background-color 0.2s ease',
            }}
          >
            Start a Campaign
          </Button>
          <Button
            component={RouterLink}
            to="/explore"
            variant="outlined"
            size="large"
            startIcon={<ExploreRounded />}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': {
                borderColor: '#C7A24A',
                bgcolor: 'rgba(199, 162, 74,0.04)',
              },
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            Explore Campaigns
          </Button>
        </Box>
      </Box>

      {/* ─── Badge Hierarchy Pyramid ─── */}
      <Box sx={{ animation: `${fadeSlideIn} 0.5s ease 0.2s both` }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Chip
            icon={<AutoAwesomeRounded sx={{ fontSize: '16px !important', color: '#C7A24A !important' }} />}
            label="BADGE HIERARCHY"
            sx={{
              fontWeight: 800,
              fontSize: '0.7rem',
              letterSpacing: '1.5px',
              mb: 1.5,
              bgcolor: 'rgba(255,215,0,0.08)',
              color: '#C7A24A',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          />
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
            Rise Through the Ranks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
            Earn badges as you give. The rarest achievements sit at the peak — only the most dedicated reach Legendary status.
          </Typography>
        </Box>

        {/* Pyramid container */}
        <Box sx={{ maxWidth: 900, mx: 'auto', position: 'relative' }}>

          {/* Connecting lines behind the pyramid */}
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none', display: { xs: 'none', md: 'block' },
            '&::before': {
              content: '""', position: 'absolute',
              top: '15%', left: '50%', width: 1, height: '70%',
              bgcolor: 'rgba(171,71,188,0.2)',
            },
          }} />

          {/* LEGENDARY — Top of pyramid (1-2 badges centered) */}
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
              color: '#C7A24A', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <Box sx={{ width: 20, height: 1, bgcolor: 'rgba(255,215,0,0.3)' }} />
              Legendary
              <Box sx={{ width: 20, height: 1, bgcolor: 'rgba(255,215,0,0.3)' }} />
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              {[...PIONEER_BADGES, ...DONATION_LEVEL_BADGES]
                .filter((b) => b.rarity === 'legendary')
                .map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} delay={0.2 + i * 0.1} />
                ))}
            </Box>
          </Box>

          {/* Divider line */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2, gap: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 120, height: 1, bgcolor: 'rgba(171,71,188,0.25)' }} />
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(171,71,188,0.3)' }} />
            <Box sx={{ flex: 1, maxWidth: 120, height: 1, bgcolor: 'rgba(171,71,188,0.25)' }} />
          </Box>

          {/* EPIC — Second tier (wider) */}
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
              color: '#AB47BC', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <Box sx={{ width: 30, height: 1, bgcolor: 'rgba(171,71,188,0.25)' }} />
              Epic
              <Box sx={{ width: 30, height: 1, bgcolor: 'rgba(171,71,188,0.25)' }} />
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              {[...PIONEER_BADGES, ...DONATION_LEVEL_BADGES]
                .filter((b) => b.rarity === 'epic')
                .map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} delay={0.4 + i * 0.1} />
                ))}
            </Box>
          </Box>

          {/* Divider line */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2, gap: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 160, height: 1, bgcolor: 'rgba(66,165,245,0.2)' }} />
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(66,165,245,0.25)' }} />
            <Box sx={{ flex: 1, maxWidth: 160, height: 1, bgcolor: 'rgba(66,165,245,0.2)' }} />
          </Box>

          {/* RARE — Third tier (wider still) */}
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
              color: '#4A6B75', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <Box sx={{ width: 40, height: 1, bgcolor: 'rgba(66,165,245,0.2)' }} />
              Rare
              <Box sx={{ width: 40, height: 1, bgcolor: 'rgba(66,165,245,0.2)' }} />
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              {[...PIONEER_BADGES, ...DONATION_LEVEL_BADGES]
                .filter((b) => b.rarity === 'rare')
                .map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} delay={0.6 + i * 0.1} />
                ))}
            </Box>
          </Box>

          {/* Divider line */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2, gap: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 200, height: 1, bgcolor: 'rgba(102,187,106,0.2)' }} />
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(102,187,106,0.2)' }} />
            <Box sx={{ flex: 1, maxWidth: 200, height: 1, bgcolor: 'rgba(102,187,106,0.2)' }} />
          </Box>

          {/* COMMON — Base of pyramid (widest) */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
              color: '#2F6B46', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <Box sx={{ width: 50, height: 1, bgcolor: 'rgba(102,187,106,0.2)' }} />
              Common
              <Box sx={{ width: 50, height: 1, bgcolor: 'rgba(102,187,106,0.2)' }} />
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              {[...PIONEER_BADGES, ...DONATION_LEVEL_BADGES]
                .filter((b) => b.rarity === 'common')
                .map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} delay={0.8 + i * 0.1} />
                ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Bottom motivational CTA */}
      <Box
        sx={{
          textAlign: 'center',
          mt: 8,
          py: 5,
          px: 3,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(199, 162, 74, 0.03)',
          animation: `${fadeSlideIn} 0.5s ease 0.6s both`,
        }}
      >
        <Box sx={{ animation: `${floatSlow} 5s ease-in-out infinite`, mb: 2 }}>
          <EmojiEventsRounded sx={{ fontSize: 40, color: '#C7A24A' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Your name could be right here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
          Join the movement, support campaigns that matter, and watch your impact grow on the leaderboard.
        </Typography>
        <Button
          component={RouterLink}
          to="/campaigns/new"
          variant="contained"
          startIcon={<RocketLaunchRounded />}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.2,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#C7A24A',
            '&:hover': {
              bgcolor: '#A07E33',
            },
          }}
        >
          Get Started
        </Button>
      </Box>
    </Box>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LeaderboardPage() {
  const [mode, setMode] = useState<SortMode>('amount')
  const [period, setPeriod] = useState<Period>('lifetime')
  const [category, setCategory] = useState<Category>('all')
  const { entries: leaderboardEntries, stats, isLoading } = useLeaderboard(period, category)

  const sorted = useMemo(() => getSorted(leaderboardEntries, mode), [leaderboardEntries, mode])
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  const isEmpty = !isLoading && leaderboardEntries.length === 0

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <EmojiEventsRounded sx={{ fontSize: 44, color: '#C7A24A' }} />
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 900,
              color: '#C7A24A',
            }}
          >
            Donor Leaderboard
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
          Celebrating our most generous community members who are driving real change across Ghana.
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 5 }}>
        <ToggleBar options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <ToggleBar options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
      </Box>

      {/* Empty State */}
      {isEmpty ? (
        <LeaderboardEmptyState />
      ) : (
        <>
          {/* Stats Summary */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 5, flexWrap: 'wrap' }}>
            {[
              { icon: <VolunteerActivismRounded sx={{ color: '#C7A24A' }} />, label: 'Total Donations', value: stats.totalDonations.toLocaleString() },
              { icon: <TrendingUpRounded sx={{ color: '#C7A24A' }} />, label: 'Total Amount', value: `GH₵ ${stats.totalAmount.toLocaleString()}` },
              { icon: <EmojiEventsRounded sx={{ color: '#C7A24A' }} />, label: 'Total Donors', value: stats.totalDonors.toLocaleString() },
            ].map((stat) => (
              <Card key={stat.label} sx={{ minWidth: 180, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 3 }} elevation={0}>
                <CardContent sx={{ py: 2.5 }}>
                  {stat.icon}
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>{stat.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Sort Toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 5 }}>
            <ToggleBar
              options={[
                { key: 'amount' as SortMode, label: 'Highest Amount', icon: <TrendingUpRounded sx={{ fontSize: 18 }} /> },
                { key: 'donations' as SortMode, label: 'Most Donations', icon: <VolunteerActivismRounded sx={{ fontSize: 18 }} /> },
              ]}
              value={mode}
              onChange={setMode}
            />
          </Box>

          {/* Loading State */}
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[0, 1, 2].map((i) => (
                  <Card key={i} elevation={0} sx={{ width: 260, textAlign: 'center', border: '2px solid', borderColor: RANK_COLORS[i], borderRadius: 4 }}>
                    <CardContent sx={{ pt: 4 }}>
                      <Skeleton variant="circular" width={72} height={72} sx={{ mx: 'auto', mb: 1.5 }} />
                      <Skeleton variant="text" width={120} sx={{ mx: 'auto' }} />
                      <Skeleton variant="text" width={80} sx={{ mx: 'auto', mb: 1 }} />
                      <Skeleton variant="rounded" width={200} height={24} sx={{ mx: 'auto' }} />
                    </CardContent>
                  </Card>
                ))}
              </Box>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="rounded" width="100%" height={48} />
              ))}
            </Box>
          ) : (
            <>
              {/* Top 3 Podium */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 6, flexWrap: 'wrap' }}>
                {top3.map((entry, i) => (
                  <Card
                    key={entry.userId}
                    elevation={0}
                    sx={{
                      width: 260,
                      textAlign: 'center',
                      border: '2px solid',
                      borderColor: RANK_COLORS[i],
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'visible',
                      animation: `${fadeSlideIn} 0.5s ease-out ${i * 0.15}s both`,
                      ...(i === 0 && { transform: 'scale(1.05)' }),
                    }}
                  >
                    <Box sx={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 36, lineHeight: 1 }}>
                      <EmojiEventsRounded sx={{ fontSize: 36, color: RANK_COLORS[i] }} />
                    </Box>
                    <CardContent sx={{ pt: 4 }}>
                      <Avatar
                        src={entry.avatarUrl}
                        alt={entry.name}
                        sx={{ width: 72, height: 72, mx: 'auto', mb: 1.5, border: '3px solid', borderColor: RANK_COLORS[i] }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{entry.name}</Typography>
                      {entry.userRole === 'organization' && (
                        <Chip
                          icon={<BusinessRounded sx={{ fontSize: '14px !important' }} />}
                          label="Organization"
                          size="small"
                          sx={{ mb: 0.5, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(66,165,245,0.1)', color: '#1E88E5' }}
                        />
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={`${entry.donationCount ?? entry.campaignsSupported} donations`} sx={{ fontWeight: 700, bgcolor: 'rgba(199, 162, 74,0.12)' }} />
                        <Chip size="small" label={`GH₵ ${entry.totalDonated.toLocaleString()}`} sx={{ fontWeight: 700, bgcolor: 'rgba(199, 162, 74,0.12)' }} />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {/* Ranked List */}
              {rest.length > 0 && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr 100px 120px 130px',
                      gap: 1,
                      px: 3,
                      py: 1.5,
                      bgcolor: 'grey.50',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>#</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Donor</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textAlign: 'right' }}>Type</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textAlign: 'right' }}>Donations</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textAlign: 'right' }}>Amount</Typography>
                  </Box>
                  {rest.map((entry, i) => {
                    const rank = i + 4
                    return (
                      <Box
                        key={entry.userId}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '48px 1fr 100px 120px 130px',
                          gap: 1,
                          px: 3,
                          py: 1.5,
                          alignItems: 'center',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          animation: `${fadeSlideIn} 0.4s ease-out ${0.45 + i * 0.08}s both`,
                          transition: 'background-color 0.2s ease',
                          '&:hover': { bgcolor: 'rgba(199, 162, 74,0.06)' },
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.secondary' }}>{rank}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar src={entry.avatarUrl} alt={entry.name} sx={{ width: 36, height: 36 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{entry.name}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip
                            size="small"
                            label={entry.userRole === 'organization' ? 'Org' : 'Person'}
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              height: 22,
                              bgcolor: entry.userRole === 'organization' ? 'rgba(66,165,245,0.1)' : 'rgba(102,187,106,0.1)',
                              color: entry.userRole === 'organization' ? '#1E88E5' : '#2F6B46',
                            }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>{(entry.donationCount ?? entry.campaignsSupported).toLocaleString()}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', color: '#2E3D2F' }}>
                          GH₵ {entry.totalDonated.toLocaleString()}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              )}

              {/* Badge Showcase */}
              <Box sx={{ mt: 8, animation: `${fadeSlideIn} 0.5s ease 0.6s both` }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Chip
                    icon={<WorkspacePremiumRounded sx={{ fontSize: '16px !important', color: '#AB47BC !important' }} />}
                    label="BADGES & ACHIEVEMENTS"
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.7rem',
                      letterSpacing: '1.5px',
                      mb: 1.5,
                      bgcolor: 'rgba(171,71,188,0.08)',
                      color: '#AB47BC',
                      border: '1px solid rgba(171,71,188,0.2)',
                    }}
                  />
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
                    Earn Badges as You Give
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto' }}>
                    Unlock achievements by donating, supporting campaigns, and being an active member of the community.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(8, 1fr)' },
                    gap: 2,
                    maxWidth: 900,
                    mx: 'auto',
                  }}
                >
                  {[...PIONEER_BADGES, ...DONATION_LEVEL_BADGES].map((badge, i) => (
                    <BadgeCard key={badge.id} badge={badge} delay={0.7 + i * 0.05} />
                  ))}
                </Box>
              </Box>
            </>
          )}
        </>
      )}
    </Container>
  )
}
