import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, ButtonBase, Skeleton, Typography } from '@mui/material'
import { SHAPE } from '@ubuntu-fund/ui'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import PeopleIcon from '@mui/icons-material/People'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import GavelIcon from '@mui/icons-material/Gavel'
import BarChartIcon from '@mui/icons-material/BarChart'
import InsightsIcon from '@mui/icons-material/Insights'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import HistoryIcon from '@mui/icons-material/History'
import CardMembershipIcon from '@mui/icons-material/CardMembership'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CampaignIcon from '@mui/icons-material/Rocket'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import TuneIcon from '@mui/icons-material/Tune'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import { Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { useAdminStats, useKYCStats } from '@/hooks/useApiData'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'

interface TileConfig {
  label: string
  icon: React.ReactNode
  route: string
  color: string
  stat: string
  description: string
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
  { label: 'Overview', icon: <InsightsIcon />, route: '/overview', color: '#8FAE96', statKey: null, description: 'platform analytics', resource: Resource.ANALYTICS },
  { label: 'Campaigns', icon: <RocketLaunchIcon />, route: '/campaigns', color: TONES.green.text, statKey: 'activeCampaigns', description: 'active campaigns', resource: Resource.CAMPAIGNS },
  { label: 'Users', icon: <PeopleIcon />, route: '/users', color: '#74909A', statKey: 'totalUsers', formatStat: formatCompact, description: 'registered users', resource: Resource.USERS },
  { label: 'Donations', icon: <VolunteerActivismIcon />, route: '/donations', color: '#C7A24A', statKey: 'totalRaised', formatStat: formatCurrency, description: 'total raised', resource: Resource.DONATIONS },
  { label: 'Disputes', icon: <GavelIcon />, route: '/disputes', color: '#C06B58', statKey: 'pendingDisputes', description: 'pending review', resource: Resource.DISPUTES },
  { label: 'Reports', icon: <BarChartIcon />, route: '/reports', color: TONES.maroon.text, statKey: 'totalDonations', description: 'analytics reports', resource: Resource.ANALYTICS },
  { label: 'Verifications', icon: <VerifiedUserIcon />, route: '/verifications', color: TONES.teal.text, statKey: null, description: 'pending verification', resource: Resource.VERIFICATIONS },
  { label: 'Audit Log', icon: <HistoryIcon />, route: '/audit', color: TONES.clay.text, statKey: null, description: 'total entries', resource: Resource.AUDIT_LOG },
  { label: 'Subscriptions', icon: <CardMembershipIcon />, route: '/subscriptions', color: TONES.maroon.text, statKey: null, description: 'active subscribers', resource: Resource.SUBSCRIPTIONS },
  { label: 'Manage Plans', icon: <TuneIcon />, route: '/plans', color: TONES.maroon.text, statKey: null, description: 'subscription packages', resource: Resource.PLANS },
  { label: 'Roles', icon: <AdminPanelSettingsIcon />, route: '/roles', color: TONES.clay.text, statKey: null, description: 'system role policy', resource: Resource.ROLES },
]

// ---------------------------------------------------------------------------
// GridTile
// ---------------------------------------------------------------------------

function StatValue({ value, loading, large = false }: { value: string; loading: boolean; large?: boolean }) {
  return loading ? (
    <Skeleton aria-label="Loading statistic" width="65%" height={large ? 40 : 28} />
  ) : (
    <Typography
      component="span"
      sx={{
        display: 'block',
        fontWeight: 800,
        fontSize: large ? { xs: '1.65rem', md: '2rem' } : '1.25rem',
        fontVariantNumeric: 'tabular-nums',
        color: 'text.primary',
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        overflowWrap: 'anywhere',
      }}
    >
      {value}
    </Typography>
  )
}

function MetricIcon({ icon, color }: { icon: React.ReactNode; color: string }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: SHAPE.sm,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-inset)',
        color,
        '& svg': { fontSize: 23 },
      }}
    >
      {icon}
    </Box>
  )
}

function GridTile({ tile, loading }: { tile: TileConfig; loading: boolean }) {
  return (
    <ButtonBase
      component={RouterLink}
      to={tile.route}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: 3,
        p: { xs: 2.5, md: 3 },
        minWidth: 0,
        minHeight: 220,
        textAlign: 'left',
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-raised)',
        transition: 'box-shadow 160ms ease, transform 160ms ease',
        '&:hover': { boxShadow: 'var(--neu-raised-hover)', transform: 'translateY(-2px)' },
        '&:active': { boxShadow: 'var(--neu-inset)', transform: 'translateY(1px)' },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 4 },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover, &:active': { transform: 'none' },
        },
      }}
    >
      <Box>
        <MetricIcon icon={tile.icon} color={tile.color} />
        <Typography component="h3" sx={{ mt: 2, fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
          {tile.label}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: '0.8rem', color: 'text.secondary' }}>
          {tile.description}
        </Typography>
      </Box>
      {tile.stat ? (
        <StatValue value={tile.stat} loading={loading} large />
      ) : (
        <Typography component="span" sx={{ color: tile.color, fontSize: '0.8rem', fontWeight: 600 }}>
          Open section <span aria-hidden="true">↗</span>
        </Typography>
      )}
    </ButtonBase>
  )
}

function StatCell({ label, value, icon, color, loading }: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  loading: boolean
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2.5,
        minWidth: 0,
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-raised)',
      }}
    >
      <MetricIcon icon={icon} color={color} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="dt" sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.75 }}>
          {label}
        </Typography>
        <Box component="dd" sx={{ m: 0 }}>
          <StatValue value={value} loading={loading} />
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useAdminStats()
  const { can } = useAdminPermissions()

  // Guard every numeric field: the stats source can momentarily be a partial or
  // unexpectedly-shaped API payload, so coerce each value to a finite number.
  // This keeps the dashboard rendering (no "undefined is not a number" / NaN).
  const safeStats = useMemo(
    () => ({
      totalRaised: Number(stats?.totalRaised) || 0,
      activeCampaigns: Number(stats?.activeCampaigns) || 0,
      totalUsers: Number(stats?.totalUsers) || 0,
      pendingDisputes: Number(stats?.pendingDisputes) || 0,
      totalDonations: Number(stats?.totalDonations) || 0,
    }),
    [stats],
  )

  const tiles = useMemo(
    () => tileTemplates
      .filter((t) => can(t.resource, t.action ?? Action.READ))
      .map((t): TileConfig => {
        let stat = ''
        if (t.statKey) {
          const raw = safeStats[t.statKey]
          stat = t.formatStat ? t.formatStat(raw) : String(raw)
        }
        return {
          label: t.label,
          icon: t.icon,
          route: t.route,
          color: t.color,
          stat: statsError && t.statKey ? '—' : stat,
          description: t.description,
          resource: t.resource,
          action: t.action,
        }
      }),
    [can, safeStats, statsError],
  )

  const { data: kycStats, isLoading: kycLoading, error: kycError } = useKYCStats()

  const quickStats = [
    { label: 'Total Raised', value: statsLoading ? '...' : `GH₵ ${safeStats.totalRaised.toLocaleString()}`, icon: <TrendingUpIcon />, color: '#8FAE96', loading: statsLoading, error: statsError },
    { label: 'Active Campaigns', value: statsLoading ? '...' : String(safeStats.activeCampaigns), icon: <CampaignIcon />, color: '#74909A', loading: statsLoading, error: statsError },
    { label: 'Total Users', value: statsLoading ? '...' : String(safeStats.totalUsers), icon: <PeopleIcon />, color: TONES.maroon.text, loading: statsLoading, error: statsError },
    { label: 'Pending Disputes', value: statsLoading ? '...' : String(safeStats.pendingDisputes), icon: <GavelIcon />, color: '#D3A95C', loading: statsLoading, error: statsError },
    { label: 'Pending KYC', value: String(kycStats?.pending ?? 0), icon: <VerifiedUserIcon />, color: TONES.teal.text, loading: kycLoading, error: kycError },
    { label: 'KYC Approved Today', value: String(kycStats?.approvedToday ?? 0), icon: <VerifiedUserIcon />, color: TONES.green.text, loading: kycLoading, error: kycError },
    { label: 'KYC Rejected Today', value: String(kycStats?.rejectedToday ?? 0), icon: <VerifiedUserIcon />, color: '#C06B58', loading: kycLoading, error: kycError },
  ]

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="green"
        eyebrow="Operations"
        title="Dashboard"
        lede="Jump into any section of the console and keep a pulse on platform activity."
        icon={<DashboardRoundedIcon />}
      />

      {(statsError || kycError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {statsError && 'Platform statistics could not be loaded. '}
          {kycError && 'KYC statistics could not be loaded. '}
          Refresh the page to try again.
        </Alert>
      )}

      <Box component="section" aria-labelledby="dashboard-sections" sx={{ mb: 4 }}>
        <Typography id="dashboard-sections" component="h2" variant="h6" sx={{ mb: 2 }}>
          Console sections
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {tiles.map((tile) => (
            <GridTile key={tile.route} tile={tile} loading={statsLoading} />
          ))}
        </Box>
      </Box>

      <Box component="section" aria-labelledby="dashboard-stats">
        <Typography id="dashboard-stats" component="h2" variant="h6" sx={{ mb: 2 }}>
          Platform statistics
        </Typography>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {quickStats.map((stat) => (
            <StatCell
              key={stat.label}
              label={stat.label}
              value={stat.error ? '—' : stat.value}
              icon={stat.icon}
              color={stat.color}
              loading={stat.loading}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
