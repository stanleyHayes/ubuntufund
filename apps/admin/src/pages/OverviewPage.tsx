import { useMemo } from 'react'
import { Box, Typography, Chip, LinearProgress } from '@mui/material'
import { keyframes } from '@mui/system'
import { BarChart } from '@mui/x-charts/BarChart'
import { PieChart } from '@mui/x-charts/PieChart'
import { LineChart } from '@mui/x-charts/LineChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import PeopleIcon from '@mui/icons-material/People'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import GavelIcon from '@mui/icons-material/Gavel'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import PublicIcon from '@mui/icons-material/Public'
import ShieldIcon from '@mui/icons-material/Shield'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import CampaignIcon from '@mui/icons-material/Rocket'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BlockIcon from '@mui/icons-material/Block'
import { CampaignStatus, VerificationLevel } from '@ubuntu-fund/types'
import { SHAPE } from '@ubuntu-fund/ui'
import {
  useMockData,
  generateCategoryBreakdown,
  generateGeographicData,
  generateFraudMetrics,
  generateDonationTrend,
} from '@/hooks/useMockData'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const B = 'rgba(255,255,255,0.06)'
const CARD_BG = 'rgba(255,255,255,0.02)'

const PIE_COLORS = ['#5E8F72', '#74909A', '#C7A24A', '#C06B58', '#AB47BC', '#26A69A', '#8D6E63']


// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  title,
  children,
  delay = 0,
  action,
}: {
  title: string
  children: React.ReactNode
  delay?: number
  action?: React.ReactNode
}) {
  return (
    <Box
      sx={{
        animation: `${fadeIn} 0.4s ease ${delay}s both`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  change,
  icon,
  color,
  delay,
}: {
  label: string
  value: string
  change?: number
  icon: React.ReactNode
  color: string
  delay: number
}) {
  const isPositive = (change ?? 0) >= 0
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: CARD_BG,
        border: `1px solid ${B}`,
        borderRadius: SHAPE.card,
        p: 2.5,
        overflow: 'hidden',
        animation: `${fadeIn} 0.4s ease ${delay}s both`,
        transition: 'border-color 0.25s ease',
        '&:hover': {
          borderColor: `${color}30`,
          '& .stat-icon-bg': { opacity: 0.08 },
        },
      }}
    >
      {/* Background icon */}
      <Box
        className="stat-icon-bg"
        sx={{
          position: 'absolute',
          right: -8,
          bottom: -8,
          color,
          opacity: 0.04,
          transition: 'opacity 0.3s ease',
          '& svg': { fontSize: 80 },
        }}
      >
        {icon}
      </Box>

      {/* Top accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: color,
          opacity: 0.5,
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ color, '& svg': { fontSize: 18 } }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: '"TT Squares", monospace',
            fontWeight: 900,
            fontSize: '1.75rem',
            color: 'text.primary',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </Typography>
        {change !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            {isPositive ? (
              <TrendingUpIcon sx={{ fontSize: 14, color: '#5E8F72' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 14, color: '#C06B58' }} />
            )}
            <Typography sx={{ fontSize: '0.7rem', color: isPositive ? '#5E8F72' : '#C06B58', fontWeight: 600 }}>
              {isPositive ? '+' : ''}{change}%
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>vs last month</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Activity item
// ---------------------------------------------------------------------------
const activityIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  donation: { icon: <VolunteerActivismIcon sx={{ fontSize: 16 }} />, color: '#C7A24A' },
  campaign_created: { icon: <RocketLaunchIcon sx={{ fontSize: 16 }} />, color: '#5E8F72' },
  user_joined: { icon: <GroupAddIcon sx={{ fontSize: 16 }} />, color: '#74909A' },
  dispute_opened: { icon: <GavelIcon sx={{ fontSize: 16 }} />, color: '#C06B58' },
  campaign_funded: { icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, color: '#5E8F72' },
}

function ActivityRow({ type, message, timestamp }: { type: string; message: string; timestamp: Date }) {
  const cfg = activityIcons[type] ?? { icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, color: '#78909C' }
  const timeAgo = getTimeAgo(timestamp)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1.5,
        borderBottom: `1px solid ${B}`,
        '&:last-child': { borderBottom: 'none' },
        transition: 'background 0.2s',
        px: 1,
        mx: -1,
        borderRadius: SHAPE.sm,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: SHAPE.sm,
          bgcolor: `${cfg.color}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: cfg.color,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {cfg.icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.primary', lineHeight: 1.4 }}>{message}</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.25 }}>{timeAgo}</Typography>
      </Box>
    </Box>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Geographic row
// ---------------------------------------------------------------------------
function GeoRow({
  country,
  campaigns,
  donations,
  maxDonations,
}: {
  country: string
  campaigns: number
  donations: number
  maxDonations: number
}) {
  const pct = (donations / maxDonations) * 100
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontWeight: 500 }}>{country}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{campaigns} campaigns</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#5E8F72', fontWeight: 600, fontFamily: '"TT Squares", monospace' }}>
            ${donations.toLocaleString()}
          </Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 4,
          borderRadius: SHAPE.bar,
          bgcolor: 'rgba(255,255,255,0.04)',
          '& .MuiLinearProgress-bar': {
            borderRadius: SHAPE.bar,
            background: '#5E8F72',
          },
        }}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fraud metric card
// ---------------------------------------------------------------------------
function FraudMetricCard({ metric, value, change }: { metric: string; value: number; change: number }) {
  const isGood = change <= 0
  return (
    <Box
      sx={{
        bgcolor: CARD_BG,
        border: `1px solid ${B}`,
        borderRadius: SHAPE.card,
        p: 2,
        textAlign: 'center',
        transition: 'border-color 0.25s ease',
        '&:hover': { borderColor: isGood ? '#5E8F7230' : '#C06B5830' },
      }}
    >
      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.75 }}>
        {metric}
      </Typography>
      <Typography sx={{ fontFamily: '"TT Squares", monospace', fontWeight: 900, fontSize: '1.4rem', color: 'text.primary', lineHeight: 1 }}>
        {metric === 'Fraud Rate' ? `${value}%` : metric === 'Avg Resolution Time' ? `${value}d` : value}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.75 }}>
        {isGood ? (
          <TrendingDownIcon sx={{ fontSize: 12, color: '#5E8F72' }} />
        ) : (
          <TrendingUpIcon sx={{ fontSize: 12, color: '#C06B58' }} />
        )}
        <Typography sx={{ fontSize: '0.65rem', color: isGood ? '#5E8F72' : '#C06B58', fontWeight: 600 }}>
          {change > 0 ? '+' : ''}{metric === 'Fraud Rate' ? `${change}%` : metric === 'Avg Resolution Time' ? `${change}d` : change}
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// OverviewPage
// ---------------------------------------------------------------------------
export default function OverviewPage() {
  const { users, campaigns, donations, disputes, stats, activity } = useMockData()

  const donationTrend = useMemo(() => generateDonationTrend(), [])
  const categoryBreakdown = useMemo(() => generateCategoryBreakdown(), [])
  const geoData = useMemo(() => generateGeographicData(), [])
  const fraudMetrics = useMemo(() => generateFraudMetrics(), [])

  // Derived analytics
  const campaignsByStatus = useMemo(() => {
    const map: Record<string, number> = {}
    campaigns.forEach((c) => {
      map[c.status] = (map[c.status] || 0) + 1
    })
    return map
  }, [campaigns])

  const verificationBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    users.forEach((u) => {
      const level = u.verificationLevel ?? 'none'
      map[level] = (map[level] || 0) + 1
    })
    return map
  }, [users])

  const topCampaigns = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => b.raisedAmount - a.raisedAmount)
        .slice(0, 5),
    [campaigns],
  )

  const donationsByMethod = useMemo(() => {
    const map: Record<string, number> = {}
    donations.forEach((d) => {
      map[d.paymentMethod] = (map[d.paymentMethod] || 0) + 1
    })
    return Object.entries(map)
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
  }, [donations])

  const trustScoreDistribution = useMemo(() => {
    const buckets = [
      { label: '0-25', min: 0, max: 25, count: 0 },
      { label: '26-50', min: 26, max: 50, count: 0 },
      { label: '51-75', min: 51, max: 75, count: 0 },
      { label: '76-100', min: 76, max: 100, count: 0 },
    ]
    users.forEach((u) => {
      const bucket = buckets.find((b) => u.trustScore >= b.min && u.trustScore <= b.max)
      if (bucket) bucket.count++
    })
    return buckets
  }, [users])

  const maxGeo = Math.max(...geoData.map((g) => g.donations))

  const statusColors: Record<string, string> = {
    [CampaignStatus.ACTIVE]: '#5E8F72',
    [CampaignStatus.PENDING_REVIEW]: '#C7A24A',
    [CampaignStatus.FUNDED]: '#74909A',
    [CampaignStatus.EXPIRED]: '#78909C',
    [CampaignStatus.BLOCKED]: '#C06B58',
    [CampaignStatus.DRAFT]: '#8D6E63',
  }

  const chartTextColor = 'rgba(255,255,255,0.45)'

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* ═══ KPI CARDS ═══ */}
      <Section title="Key Performance Indicators" delay={0}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          <StatCard label="Total Raised" value={`$${stats.totalRaised.toLocaleString()}`} change={stats.monthlyGrowth} icon={<MonetizationOnIcon />} color="#5E8F72" delay={0.05} />
          <StatCard label="Active Campaigns" value={String(stats.activeCampaigns)} change={12.1} icon={<RocketLaunchIcon />} color="#74909A" delay={0.1} />
          <StatCard label="Total Users" value={String(stats.totalUsers)} change={8.3} icon={<PeopleIcon />} color="#AB47BC" delay={0.15} />
          <StatCard label="Avg Donation" value={`$${stats.avgDonation}`} change={stats.conversionRate} icon={<VolunteerActivismIcon />} color="#C7A24A" delay={0.2} />
        </Box>
      </Section>

      {/* ═══ ROW 2: Donation trend + Category breakdown ═══ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mt: 4 }}>
        <Section title="Donation Trend (9 Months)" delay={0.1}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
              height: 320,
            }}
          >
            <LineChart
              xAxis={[{
                data: donationTrend.map((_, i) => i),
                scaleType: 'point',
                valueFormatter: (_v, ctx) => donationTrend[ctx.location === 'tick' ? _v as number : _v as number]?.month ?? '',
                tickLabelStyle: { fill: chartTextColor, fontSize: 11 },
              }]}
              yAxis={[{
                valueFormatter: (v: number) => `$${(v / 1000).toFixed(0)}k`,
                tickLabelStyle: { fill: chartTextColor, fontSize: 11 },
              }]}
              series={[{
                data: donationTrend.map((d) => d.amount),
                area: true,
                color: '#5E8F72',
                showMark: true,
              }]}
              height={280}
              margin={{ top: 20, right: 20, bottom: 30, left: 50 }}
              sx={{
                '& .MuiAreaElement-root': { fillOpacity: 0.12 },
                '& .MuiLineElement-root': { strokeWidth: 2 },
                '& .MuiMarkElement-root': { fill: '#5E8F72', stroke: '#0c0c14', strokeWidth: 2 },
                '& .MuiChartsAxis-line': { stroke: B },
                '& .MuiChartsAxis-tick': { stroke: B },
              }}
            />
          </Box>
        </Section>

        <Section title="Campaign Categories" delay={0.15}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
              height: 320,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <PieChart
              series={[{
                data: categoryBreakdown.map((c, i) => ({
                  id: i,
                  value: c.value,
                  label: c.category,
                  color: PIE_COLORS[i % PIE_COLORS.length],
                })),
                innerRadius: 45,
                outerRadius: 90,
                paddingAngle: 2,
                cornerRadius: 4,
                cx: '50%',
              }]}
              height={240}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              slotProps={{}}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 'auto', pt: 1 }}>
              {categoryBreakdown.slice(0, 5).map((c, i) => (
                <Chip
                  key={c.category}
                  label={`${c.category} ${c.value}%`}
                  size="small"
                  sx={{
                    fontSize: '0.62rem',
                    height: 22,
                    borderRadius: SHAPE.sm,
                    bgcolor: `${PIE_COLORS[i % PIE_COLORS.length]}18`,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                    border: `1px solid ${PIE_COLORS[i % PIE_COLORS.length]}25`,
                    fontWeight: 600,
                  }}
                />
              ))}
            </Box>
          </Box>
        </Section>
      </Box>

      {/* ═══ ROW 3: Campaign status + Activity feed ═══ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 4 }}>
        <Section title="Campaign Status Breakdown" delay={0.2}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
              height: 320,
            }}
          >
            <BarChart
              xAxis={[{
                data: Object.keys(campaignsByStatus).map((s) => s.replace('_', ' ')),
                scaleType: 'band',
                tickLabelStyle: { fill: chartTextColor, fontSize: 10, angle: -30 },
              }]}
              yAxis={[{
                tickLabelStyle: { fill: chartTextColor, fontSize: 11 },
              }]}
              series={[{
                data: Object.values(campaignsByStatus),
                color: '#74909A',
              }]}
              height={280}
              margin={{ top: 20, right: 20, bottom: 50, left: 40 }}
              sx={{
                '& .MuiBarElement-root': { rx: 2, ry: 8 },
                '& .MuiChartsAxis-line': { stroke: B },
                '& .MuiChartsAxis-tick': { stroke: B },
              }}
              barLabel={(item) => {
                const colors = Object.keys(campaignsByStatus).map((k) => statusColors[k] || '#74909A')
                return undefined
              }}
            />
          </Box>
        </Section>

        <Section title="Recent Activity" delay={0.25}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
              height: 320,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: SHAPE.bar },
            }}
          >
            {activity.map((a) => (
              <ActivityRow key={a.id} type={a.type} message={a.message} timestamp={a.timestamp} />
            ))}
          </Box>
        </Section>
      </Box>

      {/* ═══ ROW 4: Top campaigns + Verification + Payment methods ═══ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3, mt: 4 }}>
        {/* Top Campaigns */}
        <Section title="Top Campaigns by Raised" delay={0.3}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
            }}
          >
            {topCampaigns.map((c, i) => (
              <Box
                key={c.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.25,
                  borderBottom: i < topCampaigns.length - 1 ? `1px solid ${B}` : 'none',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"TT Squares", monospace',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    color: i === 0 ? '#C7A24A' : i === 1 ? '#A0A0B0' : i === 2 ? '#8D6E63' : 'text.secondary',
                    width: 20,
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((c.raisedAmount / c.goalAmount) * 100, 100)}
                      sx={{
                        flex: 1,
                        height: 3,
                        borderRadius: SHAPE.bar,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: SHAPE.bar,
                          bgcolor: '#5E8F72',
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', flexShrink: 0 }}>
                      {Math.round((c.raisedAmount / c.goalAmount) * 100)}%
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  sx={{
                    fontFamily: '"TT Squares", monospace',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#5E8F72',
                    flexShrink: 0,
                  }}
                >
                  ${c.raisedAmount.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Section>

        {/* Verification Levels */}
        <Section title="User Verification Levels" delay={0.35}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
            }}
          >
            {Object.entries(verificationBreakdown).map(([level, count]) => {
              const pct = Math.round((count / users.length) * 100)
              const levelColors: Record<string, string> = {
                [VerificationLevel.NONE]: '#78909C',
                [VerificationLevel.EMAIL_PHONE]: '#74909A',
                [VerificationLevel.NATIONAL_ID]: '#C7A24A',
                [VerificationLevel.INSTITUTIONAL]: '#AB47BC',
                [VerificationLevel.COMMUNITY]: '#5E8F72',
              }
              const color = levelColors[level] || '#78909C'
              return (
                <Box key={level} sx={{ mb: 1.75, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <VerifiedUserIcon sx={{ fontSize: 14, color }} />
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.primary', fontWeight: 500, textTransform: 'capitalize' }}>
                        {level.replace(/_/g, ' ')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontFamily: '"TT Squares", monospace' }}>
                      {count} ({pct}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 5,
                      borderRadius: SHAPE.bar,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: SHAPE.bar,
                        bgcolor: color,
                      },
                    }}
                  />
                </Box>
              )
            })}
          </Box>
        </Section>

        {/* Payment Methods */}
        <Section title="Payment Methods" delay={0.4}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
            }}
          >
            {donationsByMethod.map((pm, i) => {
              const total = donations.length
              const pct = Math.round((pm.count / total) * 100)
              const colors = ['#5E8F72', '#74909A', '#C7A24A', '#AB47BC', '#C06B58', '#26A69A', '#8D6E63']
              const color = colors[i % colors.length]
              return (
                <Box key={pm.method} sx={{ mb: 1.75, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.primary', fontWeight: 500, textTransform: 'capitalize' }}>
                      {pm.method.replace(/_/g, ' ')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontFamily: '"TT Squares", monospace' }}>
                      {pm.count} ({pct}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 5,
                      borderRadius: SHAPE.bar,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiLinearProgress-bar': { borderRadius: SHAPE.bar, bgcolor: color },
                    }}
                  />
                </Box>
              )
            })}
          </Box>
        </Section>
      </Box>

      {/* ═══ ROW 5: Geographic + Trust Score + Fraud ═══ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 4 }}>
        {/* Geographic Distribution */}
        <Section title="Geographic Distribution" delay={0.45} action={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}><PublicIcon sx={{ fontSize: 14 }} /><Typography sx={{ fontSize: '0.62rem' }}>8 countries</Typography></Box>}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2.5,
            }}
          >
            {geoData.map((g) => (
              <GeoRow key={g.country} country={g.country} campaigns={g.campaigns} donations={g.donations} maxDonations={maxGeo} />
            ))}
          </Box>
        </Section>

        {/* Trust Score Distribution */}
        <Section title="Trust Score Distribution" delay={0.5}>
          <Box
            sx={{
              bgcolor: CARD_BG,
              border: `1px solid ${B}`,
              borderRadius: SHAPE.card,
              p: 2,
              height: 320,
            }}
          >
            <BarChart
              xAxis={[{
                data: trustScoreDistribution.map((b) => b.label),
                scaleType: 'band',
                tickLabelStyle: { fill: chartTextColor, fontSize: 11 },
              }]}
              yAxis={[{
                tickLabelStyle: { fill: chartTextColor, fontSize: 11 },
              }]}
              series={[{
                data: trustScoreDistribution.map((b) => b.count),
                color: '#AB47BC',
              }]}
              height={280}
              margin={{ top: 20, right: 20, bottom: 30, left: 40 }}
              sx={{
                '& .MuiBarElement-root': { rx: 2, ry: 8 },
                '& .MuiChartsAxis-line': { stroke: B },
                '& .MuiChartsAxis-tick': { stroke: B },
              }}
            />
          </Box>
        </Section>
      </Box>

      {/* ═══ ROW 6: Fraud & Safety Metrics ═══ */}
      <Box sx={{ mt: 4, mb: 2 }}>
        <Section
          title="Fraud & Safety Metrics"
          delay={0.55}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <ShieldIcon sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: '0.62rem' }}>Platform safety</Typography>
            </Box>
          }
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {fraudMetrics.map((fm) => (
              <FraudMetricCard key={fm.metric} metric={fm.metric} value={fm.value} change={fm.change} />
            ))}
          </Box>
        </Section>
      </Box>

      {/* ═══ ROW 7: Quick summary stats bar ═══ */}
      <Box
        sx={{
          mt: 3,
          mb: 1,
          bgcolor: CARD_BG,
          border: `1px solid ${B}`,
          borderRadius: SHAPE.card,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
          animation: `${fadeIn} 0.4s ease 0.6s both`,
        }}
      >
        {[
          { label: 'Total Donations', value: stats.totalDonations, icon: <VolunteerActivismIcon sx={{ fontSize: 16 }} />, color: '#C7A24A' },
          { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, color: '#5E8F72' },
          { label: 'Pending Disputes', value: stats.pendingDisputes, icon: <GavelIcon sx={{ fontSize: 16 }} />, color: '#C06B58' },
          { label: 'Active Campaigns', value: stats.activeCampaigns, icon: <CampaignIcon sx={{ fontSize: 16 }} />, color: '#74909A' },
          { label: 'Verified Users', value: users.filter((u) => u.verificationLevel !== VerificationLevel.NONE).length, icon: <VerifiedUserIcon sx={{ fontSize: 16 }} />, color: '#AB47BC' },
          { label: 'Monthly Growth', value: `${stats.monthlyGrowth}%`, icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, color: '#5E8F72' },
        ].map((s, i) => (
          <Box
            key={s.label}
            sx={{
              px: 2,
              py: 2,
              borderRight: { xs: i % 2 === 0 ? `1px solid ${B}` : 'none', sm: i % 3 < 2 ? `1px solid ${B}` : 'none', md: i < 5 ? `1px solid ${B}` : 'none' },
              borderBottom: { xs: i < 4 ? `1px solid ${B}` : 'none', sm: i < 3 ? `1px solid ${B}` : 'none', md: 'none' },
              textAlign: 'center',
              transition: 'background 0.2s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.75, color: s.color }}>
              {s.icon}
            </Box>
            <Typography sx={{ fontFamily: '"TT Squares", monospace', fontWeight: 900, fontSize: '1.1rem', color: 'text.primary', lineHeight: 1 }}>
              {s.value}
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', mt: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
