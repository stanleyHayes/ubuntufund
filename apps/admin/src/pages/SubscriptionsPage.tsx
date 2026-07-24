import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, MenuItem, InputAdornment, Button } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import { EmptyState } from '@ubuntu-fund/ui'
import PeopleIcon from '@mui/icons-material/People'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import StarIcon from '@mui/icons-material/Star'
import CardMembershipIcon from '@mui/icons-material/CardMembership'
import VisibilityIcon from '@mui/icons-material/Visibility'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import CancelIcon from '@mui/icons-material/Cancel'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  SUBSCRIPTION_PLANS,
  Resource,
  Action,
} from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const countUp = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`
const fillBar = keyframes`from{transform:scaleX(0)}to{transform:scaleX(1)}`
const B = 'rgba(255,255,255,0.06)'

// ---------------------------------------------------------------------------
// Tier colors
// ---------------------------------------------------------------------------
const tierColors: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: '#78909C',
  [SubscriptionTier.STARTER]: '#74909A',
  [SubscriptionTier.PRO]: '#AB47BC',
  [SubscriptionTier.ENTERPRISE]: '#C7A24A',
}

const statusColors: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.ACTIVE]: '#5E8F72',
  [SubscriptionStatus.EXPIRED]: '#78909C',
  [SubscriptionStatus.CANCELLED]: '#C06B58',
  [SubscriptionStatus.PAST_DUE]: '#D3A95C',
  [SubscriptionStatus.TRIALING]: '#74909A',
}

// ---------------------------------------------------------------------------
// Mock subscription data
// ---------------------------------------------------------------------------
interface MockSubscription {
  id: string
  userId: string
  userName: string
  email: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  billingCycle: BillingCycle
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

const MOCK_NAMES = [
  'Amara Okafor', 'Bongani Dlamini', 'Chidera Eze', 'Dakarai Mwangi',
  'Eshe Kimani', 'Folami Adeyemi', 'Gathoni Njeri', 'Halima Yusuf',
  'Imani Kato', 'Jabari Osei', 'Kamau Njoroge', 'Lethabo Mokoena',
  'Makena Wanjiku', 'Nia Mensah', 'Olumide Balogun', 'Palesa Nkosi',
  'Quame Asante', 'Rehema Mushi', 'Sipho Ndlovu', 'Thandiwe Banda',
]

function generateMockSubscriptions(): MockSubscription[] {
  const tiers = [SubscriptionTier.FREE, SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]
  const statuses = [SubscriptionStatus.ACTIVE, SubscriptionStatus.ACTIVE, SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIALING]
  const cycles = [BillingCycle.MONTHLY, BillingCycle.YEARLY]

  return MOCK_NAMES.map((name, i) => {
    const tier = tiers[i % tiers.length]
    const status = statuses[i % statuses.length]
    const cycle = cycles[i % cycles.length]
    const start = new Date(2025, 6 + (i % 6), 1 + (i % 28))
    const end = new Date(start)
    if (cycle === BillingCycle.MONTHLY) {
      end.setMonth(end.getMonth() + 1)
    } else {
      end.setFullYear(end.getFullYear() + 1)
    }

    return {
      id: `sub_${String(i + 1).padStart(3, '0')}`,
      userId: `usr_${String(i + 1).padStart(3, '0')}`,
      userName: name,
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      tier,
      status,
      billingCycle: cycle,
      currentPeriodStart: start,
      currentPeriodEnd: end,
    }
  })
}

const mockSubscriptions = generateMockSubscriptions()

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------
const totalSubscribers = mockSubscriptions.length
const paidUsers = mockSubscriptions.filter(s => s.tier !== SubscriptionTier.FREE).length
const freeUsers = mockSubscriptions.filter(s => s.tier === SubscriptionTier.FREE).length
const monthlyRevenue = mockSubscriptions
  .filter(s => s.status === SubscriptionStatus.ACTIVE && s.tier !== SubscriptionTier.FREE)
  .reduce((sum, s) => {
    const plan = SUBSCRIPTION_PLANS[s.tier]
    return sum + (s.billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly / 12)
  }, 0)

// Revenue breakdown by tier
const revenueByTier = Object.values(SubscriptionTier).filter(t => t !== SubscriptionTier.FREE).map(tier => {
  const subs = mockSubscriptions.filter(s => s.tier === tier && s.status === SubscriptionStatus.ACTIVE)
  const rev = subs.reduce((sum, s) => {
    const plan = SUBSCRIPTION_PLANS[s.tier]
    return sum + (s.billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly / 12)
  }, 0)
  return { tier, name: SUBSCRIPTION_PLANS[tier].name, count: subs.length, revenue: rev, color: tierColors[tier] }
})
const totalRevForBar = Math.max(1, revenueByTier.reduce((s, r) => s + r.revenue, 0))

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '2fr 0.9fr 0.8fr 0.8fr 1.1fr 1.1fr 2fr',
      gap: 2,
      px: 3, py: 2,
      borderBottom: `1px solid ${B}`,
      animation: `${fadeIn} 0.4s ease ${index * 0.05}s both`,
    }}>
      {Array.from({ length: 7 }).map((_, i) => <Skel key={i} w={i === 0 ? '80%' : '60%'} h={14} />)}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({
  label, value, icon, color, index,
}: {
  label: string; value: string; icon: React.ReactNode; color: string; index: number
}) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      px: 3, py: 2.5,
      borderRight: `1px solid ${B}`,
      animation: `${countUp} 0.5s ease ${0.3 + index * 0.1}s both`,
      transition: 'all 0.25s ease',
      '&:hover': {
        '& .stat-value': { color },
      },
    }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, bgcolor: color, opacity: 0.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ color, opacity: 0.7, '& .MuiSvgIcon-root': { fontSize: 22 } }}>{icon}</Box>
        <Box>
          <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1, mb: 0.5 }}>
            {label}
          </Typography>
          <Typography className="stat-value" sx={{
            fontFamily: '"TT Squares", monospace', fontWeight: 900, fontSize: '1.15rem',
            color: 'text.primary', lineHeight: 1, letterSpacing: '-0.01em', transition: 'color 0.25s ease',
          }}>
            {value}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SubscriptionRow
// ---------------------------------------------------------------------------
function SubscriptionRow({ sub, index }: { sub: MockSubscription; index: number }) {
  const navigate = useNavigate()
  const { can } = useAdminPermissions()
  const canUpdate = can(Resource.SUBSCRIPTIONS, Action.UPDATE)
  const tierColor = tierColors[sub.tier]
  const statusColor = statusColors[sub.status]

  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: '2fr 0.9fr 0.8fr 0.8fr 1.1fr 1.1fr 2fr' },
      gap: { xs: 0.5, md: 2 },
      alignItems: 'center',
      px: 3, py: 2,
      borderBottom: `1px solid ${B}`,
      cursor: 'default',
      transition: 'all 0.3s ease',
      animation: `${slideIn} 0.4s ease ${index * 0.03}s both`,
      '&:hover': {
        bgcolor: 'rgba(255,255,255,0.02)',
      },
    }}>
      {/* User Name + Email */}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub.userName}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub.email}
        </Typography>
      </Box>

      {/* Tier Chip */}
      <Box>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 1.2, py: 0.3,
          border: `1px solid ${tierColor}40`,
          bgcolor: `${tierColor}12`,
        }}>
          <Box sx={{ width: 6, height: 6, bgcolor: tierColor, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: tierColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {SUBSCRIPTION_PLANS[sub.tier].name}
          </Typography>
        </Box>
      </Box>

      {/* Status */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
          {sub.status.replace('_', ' ')}
        </Typography>
      </Box>

      {/* Billing Cycle */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'capitalize' }}>
          {sub.billingCycle}
        </Typography>
      </Box>

      {/* Period Start */}
      <Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"TT Squares", monospace', whiteSpace: 'nowrap' }}>
          {sub.currentPeriodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      </Box>

      {/* Period End */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"TT Squares", monospace', whiteSpace: 'nowrap' }}>
          {sub.currentPeriodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
          <Button
            size="small"
            onClick={() => navigate(`/users/${sub.userId}`)}
            sx={{
              minWidth: 0, px: 1, py: 0.3, fontSize: '0.65rem', fontWeight: 700,
              color: '#74909A', borderColor: 'rgba(116,144,154,0.3)', textTransform: 'none',
              border: '1px solid', '&:hover': { bgcolor: 'rgba(116,144,154,0.08)' },
            }}
          >
            <VisibilityIcon sx={{ fontSize: 13, mr: 0.3 }} />
            View
          </Button>
          {canUpdate && (
            <Button
              size="small"
              sx={{
                minWidth: 0, px: 1, py: 0.3, fontSize: '0.65rem', fontWeight: 700,
                color: '#AB47BC', borderColor: 'rgba(171,71,188,0.3)', textTransform: 'none',
                border: '1px solid', '&:hover': { bgcolor: 'rgba(171,71,188,0.08)' },
              }}
            >
              <SwapHorizIcon sx={{ fontSize: 13, mr: 0.3 }} />
              Tier
            </Button>
          )}
          {canUpdate && sub.status === SubscriptionStatus.ACTIVE && (
            <Button
              size="small"
              sx={{
                minWidth: 0, px: 1, py: 0.3, fontSize: '0.65rem', fontWeight: 700,
                color: '#C06B58', borderColor: 'rgba(192,107,88,0.3)', textTransform: 'none',
                border: '1px solid', '&:hover': { bgcolor: 'rgba(192,107,88,0.08)' },
              }}
            >
              <CancelIcon sx={{ fontSize: 13, mr: 0.3 }} />
              Cancel
            </Button>
          )}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SubscriptionsPage
// ---------------------------------------------------------------------------
export default function SubscriptionsPage() {
  const PAGE_SIZE = 10
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t) }, [])

  const filtered = mockSubscriptions.filter(s => {
    if (tierFilter !== 'all' && s.tier !== tierFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.userName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.3s ease` }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${B}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CardMembershipIcon sx={{ color: '#AB47BC', fontSize: 20 }} />
        <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'text.primary' }}>
          Subscriptions
        </Typography>
      </Box>

      {/* Stats row */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        borderBottom: `1px solid ${B}`,
      }}>
        <StatCard label="Total Subscribers" value={String(totalSubscribers)} icon={<PeopleIcon />} color="#74909A" index={0} />
        <StatCard label="Monthly Revenue" value={`$${monthlyRevenue.toFixed(0)}`} icon={<AttachMoneyIcon />} color="#5E8F72" index={1} />
        <StatCard label="Free Users" value={String(freeUsers)} icon={<PersonOffIcon />} color="#78909C" index={2} />
        <StatCard label="Paid Users" value={String(paidUsers)} icon={<StarIcon />} color="#AB47BC" index={3} />
      </Box>

      {/* Revenue breakdown by tier */}
      <Box sx={{ borderBottom: `1px solid ${B}`, px: 3, py: 2 }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
          Revenue by Tier
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {revenueByTier.map((r, i) => (
            <Box key={r.tier} sx={{ flex: 1, minWidth: 140, animation: `${countUp} 0.5s ease ${0.5 + i * 0.1}s both` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: r.color, fontWeight: 700 }}>{r.name}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: '"TT Squares", monospace' }}>
                  ${r.revenue.toFixed(0)}/mo
                </Typography>
              </Box>
              <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <Box sx={{
                  width: `${(r.revenue / totalRevForBar) * 100}%`,
                  height: '100%', bgcolor: r.color, transformOrigin: 'left',
                  animation: `${fillBar} 1s ${0.6 + i * 0.1}s ease both`,
                }} />
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.3 }}>
                {r.count} subscriber{r.count !== 1 ? 's' : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, borderBottom: `1px solid ${B}` }}>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="standard"
            placeholder="Search subscribers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#AB47BC' } },
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            select size="small" variant="standard" label="Tier"
            value={tierFilter} onChange={e => setTierFilter(e.target.value)} fullWidth
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#AB47BC' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          >
            <MenuItem value="all">All Tiers</MenuItem>
            {Object.values(SubscriptionTier).map(t => (
              <MenuItem key={t} value={t}>{SUBSCRIPTION_PLANS[t].name}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            select size="small" variant="standard" label="Status"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)} fullWidth
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#AB47BC' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(SubscriptionStatus).map(s => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"TT Squares", monospace', fontSize: '0.82rem', color: 'text.secondary' }}>
            {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Table header */}
      <Box sx={{
        display: { xs: 'none', md: 'grid' },
        gridTemplateColumns: '2fr 0.9fr 0.8fr 0.8fr 1.1fr 1.1fr 2fr',
        gap: 2, px: 3, py: 1.2,
        borderBottom: `1px solid ${B}`,
        bgcolor: 'rgba(255,255,255,0.02)',
      }}>
        {['User', 'Tier', 'Status', 'Billing', 'Period Start', 'Period End', 'Actions'].map(h => (
          <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      <Box>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} index={i} />)
          : pagination.page.map((sub, i) => (
              <SubscriptionRow key={sub.id} sub={sub} index={i} />
            ))
        }
      </Box>

      {!loading && <PaginationBar pagination={pagination} accentColor="#AB47BC" />}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <EmptyState variant="search" title="No subscriptions found" description="No subscriptions match your filters. Try adjusting your search criteria." compact />
      )}
    </Box>
  )
}
