import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { keyframes } from '@mui/system'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import PeopleIcon from '@mui/icons-material/People'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import GavelIcon from '@mui/icons-material/Gavel'
import BarChartIcon from '@mui/icons-material/BarChart'
import InsightsIcon from '@mui/icons-material/Insights'
import SettingsIcon from '@mui/icons-material/Settings'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import HistoryIcon from '@mui/icons-material/History'
import CardMembershipIcon from '@mui/icons-material/CardMembership'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CampaignIcon from '@mui/icons-material/Rocket'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import TuneIcon from '@mui/icons-material/Tune'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import { Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { useAdminStats, useKYCStats } from '@/hooks/useApiData'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

const countUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`

const drawSparkline = keyframes`
  from { stroke-dashoffset: 300; }
  to   { stroke-dashoffset: 0; }
`

const fillBar = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const B = 'rgba(255,255,255,0.06)'

// ---------------------------------------------------------------------------
// Mini sparkline — generates a random trend line SVG
// ---------------------------------------------------------------------------

function MiniSparkline({ color, seed }: { color: string; seed: number }) {
  const points = useMemo(() => {
    const pts: number[] = []
    let val = 30 + (seed * 17) % 20
    for (let i = 0; i < 12; i++) {
      val += ((seed * (i + 1) * 7) % 15) - 6
      val = Math.max(5, Math.min(45, val))
      pts.push(val)
    }
    return pts
  }, [seed])

  const pathD = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${i * (80 / 11)},${y}`)
    .join(' ')

  return (
    <svg
      width="80"
      height="50"
      viewBox="0 0 80 50"
      style={{ overflow: 'visible' }}
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={`spark-fill-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${pathD} L80,50 L0,50 Z`}
        fill={`url(#spark-fill-${seed})`}
        opacity={0}
        style={{ animation: `${fadeIn} 0.8s 0.6s ease forwards` }}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="300"
        strokeDashoffset="300"
        style={{ animation: `${drawSparkline} 1.2s 0.3s ease forwards` }}
      />
      {/* End dot */}
      <circle
        cx={80}
        cy={points[points.length - 1]}
        r="2"
        fill={color}
        opacity={0}
        style={{ animation: `${fadeIn} 0.3s 1.4s ease forwards` }}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Tile config
// ---------------------------------------------------------------------------

interface TileConfig {
  label: string
  icon: React.ReactNode
  route: string
  color: string
  stat: string
  description: string
  // Visual variation
  glowPosition: string // CSS position for the radial glow
  patternAngle: number // degrees for the diagonal lines
  // RBAC
  resource: Resource
  action?: Action
}

type StatKey = 'activeCampaigns' | 'totalUsers' | 'totalRaised' | 'pendingDisputes' | 'totalDonations' | null

interface TileTemplate {
  label: string
  icon: React.ReactNode
  route: string
  color: string
  statKey: StatKey
  formatStat?: (val: number) => string
  description: string
  glowPosition: string
  patternAngle: number
  resource: Resource
  action?: Action
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `GH₵ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `GH₵ ${(val / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(val)
}

function formatCompact(val: number): string {
  if (val >= 10_000) return `${(val / 1_000).toFixed(1)}K`
  return String(val)
}

const tileTemplates: TileTemplate[] = [
  { label: 'Overview', icon: <InsightsIcon />, route: '/overview', color: '#8FAE96', statKey: null, description: 'platform analytics', glowPosition: 'center', patternAngle: 0, resource: Resource.ANALYTICS },
  { label: 'Campaigns', icon: <RocketLaunchIcon />, route: '/campaigns', color: '#5E8F72', statKey: 'activeCampaigns', description: 'active campaigns', glowPosition: 'top right', patternAngle: 45, resource: Resource.CAMPAIGNS },
  { label: 'Users', icon: <PeopleIcon />, route: '/users', color: '#74909A', statKey: 'totalUsers', formatStat: formatCompact, description: 'registered users', glowPosition: 'bottom left', patternAngle: -45, resource: Resource.USERS },
  { label: 'Donations', icon: <VolunteerActivismIcon />, route: '/donations', color: '#C7A24A', statKey: 'totalRaised', formatStat: formatCurrency, description: 'total raised', glowPosition: 'top left', patternAngle: 30, resource: Resource.DONATIONS },
  { label: 'Disputes', icon: <GavelIcon />, route: '/disputes', color: '#C06B58', statKey: 'pendingDisputes', description: 'pending review', glowPosition: 'bottom right', patternAngle: -30, resource: Resource.DISPUTES },
  { label: 'Reports', icon: <BarChartIcon />, route: '/reports', color: TONES.maroon.text, statKey: 'totalDonations', description: 'analytics reports', glowPosition: 'center right', patternAngle: 60, resource: Resource.ANALYTICS },
  { label: 'Settings', icon: <SettingsIcon />, route: '/settings', color: '#78909C', statKey: null, description: 'system configuration', glowPosition: 'center left', patternAngle: -60, resource: Resource.SETTINGS },
  { label: 'Verifications', icon: <VerifiedUserIcon />, route: '/verifications', color: TONES.teal.text, statKey: null, description: 'pending verification', glowPosition: 'top center', patternAngle: 15, resource: Resource.VERIFICATIONS },
  { label: 'Audit Log', icon: <HistoryIcon />, route: '/audit', color: TONES.clay.text, statKey: null, description: 'total entries', glowPosition: 'bottom center', patternAngle: -15, resource: Resource.AUDIT_LOG },
  { label: 'Subscriptions', icon: <CardMembershipIcon />, route: '/subscriptions', color: TONES.maroon.text, statKey: null, description: 'active subscribers', glowPosition: 'center left', patternAngle: 25, resource: Resource.SUBSCRIPTIONS },
  { label: 'Manage Plans', icon: <TuneIcon />, route: '/plans', color: TONES.maroon.text, statKey: null, description: 'subscription packages', glowPosition: 'top left', patternAngle: -20, resource: Resource.PLANS },
  { label: 'Roles', icon: <AdminPanelSettingsIcon />, route: '/roles', color: '#FF7043', statKey: null, description: 'role management', glowPosition: 'top right', patternAngle: 35, resource: Resource.ROLES },
  { label: 'Invite User', icon: <PersonAddIcon />, route: '/invite', color: TONES.teal.text, statKey: null, description: 'create admin user', glowPosition: 'bottom left', patternAngle: -35, resource: Resource.USERS, action: Action.CREATE },
]

// ---------------------------------------------------------------------------
// GridTile
// ---------------------------------------------------------------------------

function GridTile({ tile, index }: { tile: TileConfig; index: number }) {
  const navigate = useNavigate()

  // Create diagonal line pattern as inline SVG data URL
  const patternSvg = encodeURIComponent(
    `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="20" x2="20" y2="0" stroke="white" stroke-opacity="0.02" stroke-width="0.5"/></svg>`
  )

  return (
    <Box
      onClick={() => navigate(tile.route)}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: { xs: 1.5, sm: 2, md: 3 },
        cursor: 'pointer',
        bgcolor: 'transparent',
        borderRight: `1px solid ${B}`,
        borderBottom: `1px solid ${B}`,
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: `${slideIn} 0.4s ease ${index * 0.06}s both`,
        overflow: 'hidden',
        minHeight: { xs: 160, md: 200 },
        // Remove right border on last column per breakpoint
        '&:nth-of-type(2n)': {
          borderRight: { xs: 'none', md: `1px solid ${B}` },
        },
        '&:nth-of-type(4n)': {
          borderRight: { xs: `1px solid ${B}`, md: 'none' },
        },
        // Hover state
        '&:hover': {
          '& .tile-glow': {
            opacity: 0.12,
          },
          '& .tile-scan': {
            animationPlayState: 'running',
          },
          '& .tile-icon-wrap': {
            bgcolor: `${tile.color}15`,
          },
          '& .tile-stat': {
            color: tile.color,
          },
          '& .tile-watermark': {
            opacity: 0.06,
          },
          '& .tile-sparkline': {
            opacity: 1,
          },
          '& .tile-accent-top': {
            opacity: 1,
            backgroundSize: '100% 100%',
          },
        },
      }}
    >
      {/* === Radial glow — unique position per tile === */}
      <Box
        className="tile-glow"
        sx={{
          position: 'absolute',
          inset: 0,
          background: `${tile.color}10`,
          opacity: 0.04,
          transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
        }}
      />

      {/* === Diagonal line texture === */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,${patternSvg}")`,
          backgroundSize: '20px 20px',
          transform: `rotate(${tile.patternAngle}deg) scale(1.5)`,
          pointerEvents: 'none',
        }}
      />

      {/* === Top accent gradient line === */}
      <Box
        className="tile-accent-top"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: tile.color,
          opacity: 0.35,
          transition: 'opacity 0.35s ease',
        }}
      />

      {/* === Scan line (plays on hover) === */}
      <Box
        className="tile-scan"
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 1,
          background: `${tile.color}20`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* === Large watermark number === */}
      {tile.stat && (
        <Typography
          className="tile-watermark"
          sx={{
            position: 'absolute',
            right: -8,
            bottom: -16,
            fontFamily: '"Outfit", monospace',
            fontWeight: 900,
            fontSize: { xs: '5rem', md: '6.5rem' },
            color: 'white',
            opacity: 0.03,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            transition: 'all 0.5s ease',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {tile.stat}
        </Typography>
      )}

      {/* === Top section: icon + info === */}
      <Box sx={{ position: 'relative', zIndex: 2 }}>
        {/* Icon */}
        <Box
          className="tile-icon-wrap"
          sx={{
            position: 'relative',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            borderRadius: 1,
            transition: 'background-color 0.2s ease',
          }}
        >
          <Box
            sx={{
              color: tile.color,
              '& .MuiSvgIcon-root': { fontSize: 28 },
            }}
          >
            {tile.icon}
          </Box>
        </Box>

        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'text.primary',
            letterSpacing: '0.01em',
          }}
        >
          {tile.label}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.68rem',
            color: 'text.secondary',
            mt: 0.3,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {tile.description}
        </Typography>
      </Box>

      {/* === Bottom section: stat + sparkline === */}
      <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {tile.stat ? (
          <Typography
            className="tile-stat"
            sx={{
              fontFamily: '"Outfit", monospace',
              fontWeight: 900,
              fontSize: { xs: '1.5rem', md: '2rem' },
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1,
              transition: 'all 0.35s ease',
              letterSpacing: '-0.02em',
            }}
          >
            {tile.stat}
          </Typography>
        ) : (
          <Box />
        )}

        {/* Mini sparkline chart */}
        <Box
          className="tile-sparkline"
          sx={{
            opacity: 0.5,
            transition: 'opacity 0.35s ease',
            flexShrink: 0,
          }}
        >
          <MiniSparkline color={tile.color} seed={index + 1} />
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// StatCell
// ---------------------------------------------------------------------------

function StatCell({
  label,
  value,
  icon,
  color,
  index,
  isLast,
  fillPercent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  index: number
  isLast: boolean
  fillPercent: number
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 2.5,
        borderRight: isLast ? 'none' : `1px solid ${B}`,
        animation: `${countUp} 0.5s ease ${0.5 + index * 0.1}s both`,
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        '&:hover': {
          '& .stat-fill': {
            opacity: 0.08,
          },
          '& .stat-value': {
            color,
          },
        },
      }}
    >
      {/* Background fill bar */}
      <Box
        className="stat-fill"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${fillPercent}%`,
          bgcolor: color,
          opacity: 0.04,
          transformOrigin: 'left',
          animation: `${fillBar} 1s ${0.8 + index * 0.1}s ease both`,
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Left color accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 2,
          bgcolor: color,
          opacity: 0.5,
        }}
      />

      <Box
        sx={{
          color,
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center',
          '& .MuiSvgIcon-root': { fontSize: 20 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography
          sx={{
            fontSize: '0.62rem',
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            lineHeight: 1,
            mb: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography
          className="stat-value"
          sx={{
            fontFamily: '"Outfit", monospace',
            fontWeight: 900,
            fontSize: '1.15rem',
            color: 'text.primary',
            lineHeight: 1,
            letterSpacing: '-0.01em',
            transition: 'color 0.25s ease',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { can } = useAdminPermissions()

  const tiles = useMemo(
    () => tileTemplates
      .filter((t) => can(t.resource, t.action ?? Action.READ))
      .map((t): TileConfig => {
        let stat = ''
        if (t.statKey && stats) {
          const raw = stats[t.statKey]
          stat = t.formatStat ? t.formatStat(raw) : String(raw)
        }
        return {
          label: t.label,
          icon: t.icon,
          route: t.route,
          color: t.color,
          stat: statsLoading ? '' : stat,
          description: t.description,
          glowPosition: t.glowPosition,
          patternAngle: t.patternAngle,
          resource: t.resource,
          action: t.action,
        }
      }),
    [can, stats, statsLoading],
  )

  const maxStatVal = Math.max(stats.totalRaised, stats.activeCampaigns * 1000, stats.totalUsers * 100, stats.pendingDisputes * 5000, 1)

  const { data: kycStats } = useKYCStats()

  const quickStats = [
    { label: 'Total Raised', value: statsLoading ? '...' : `GH₵ ${stats.totalRaised.toLocaleString()}`, icon: <TrendingUpIcon />, color: '#8FAE96', fill: statsLoading ? 0 : (stats.totalRaised / maxStatVal) * 100 },
    { label: 'Active Campaigns', value: statsLoading ? '...' : String(stats.activeCampaigns), icon: <CampaignIcon />, color: '#74909A', fill: statsLoading ? 0 : ((stats.activeCampaigns * 1000) / maxStatVal) * 100 },
    { label: 'Total Users', value: statsLoading ? '...' : String(stats.totalUsers), icon: <PeopleIcon />, color: TONES.maroon.text, fill: statsLoading ? 0 : ((stats.totalUsers * 100) / maxStatVal) * 100 },
    { label: 'Pending Disputes', value: statsLoading ? '...' : String(stats.pendingDisputes), icon: <GavelIcon />, color: '#D3A95C', fill: statsLoading ? 0 : ((stats.pendingDisputes * 5000) / maxStatVal) * 100 },
    { label: 'Pending KYC', value: String(kycStats?.pending ?? 0), icon: <VerifiedUserIcon />, color: TONES.teal.text, fill: 0 },
    { label: 'KYC Approved Today', value: String(kycStats?.approvedToday ?? 0), icon: <VerifiedUserIcon />, color: '#5E8F72', fill: 0 },
    { label: 'KYC Rejected Today', value: String(kycStats?.rejectedToday ?? 0), icon: <VerifiedUserIcon />, color: '#C06B58', fill: 0 },
  ]

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0c0c14',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 3, pt: 3 }}>
        <PageHeader
          tone="green"
          eyebrow="Operations"
          title="Dashboard"
          lede="Jump into any section of the console and keep a pulse on platform activity as it happens."
          icon={<DashboardRoundedIcon />}
        />
      </Box>

      {/* ═══ MAIN GRID — 4 columns, edge to edge ═══ */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {tiles.map((tile, i) => (
          <GridTile key={tile.route} tile={tile} index={i} />
        ))}
      </Box>

      {/* ═══ STATS BAR — full width ═══ */}
      <Box
        sx={{
          borderTop: `1px solid ${B}`,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {quickStats.map((s, i) => (
          <StatCell
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            color={s.color}
            index={i}
            isLast={i === quickStats.length - 1}
            fillPercent={s.fill}
          />
        ))}
      </Box>
    </Box>
  )
}
