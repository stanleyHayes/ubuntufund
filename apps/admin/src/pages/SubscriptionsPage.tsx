import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton, Box, Typography, MenuItem, InputAdornment, Button } from '@mui/material'
import { raisedSurface, insetSurface, progressTrack } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import { EmptyState } from '@ubuntu-fund/ui'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
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
import type { Subscription } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'


// ---------------------------------------------------------------------------
// Tier colors
// ---------------------------------------------------------------------------
const tierColors: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: '#78909C',
  [SubscriptionTier.STARTER]: '#74909A',
  [SubscriptionTier.PRO]: TONES.maroon.text,
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
// Subscription read model
// ---------------------------------------------------------------------------
interface AdminSubscription extends Subscription {
  userName: string
  email: string
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
  )
}

function SkeletonRow() {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: '2fr 0.9fr 0.8fr 0.8fr 1.1fr 1.1fr 2fr' },
      gap: 2,
      px: 3, py: 2,
      ...raisedSurface,
    }}>
      {Array.from({ length: 7 }).map((_, i) => <Skel key={i} w={i === 0 ? '80%' : '60%'} h={14} />)}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SubscriptionRow
// ---------------------------------------------------------------------------
function SubscriptionRow({ sub }: { sub: AdminSubscription }) {
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
      ...raisedSurface,
      cursor: 'default',
      transition: 'box-shadow 160ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      '&:hover': {
        bgcolor: 'background.paper',
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
          ...insetSurface,
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
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {new Date(sub.currentPeriodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      </Box>

      {/* Period End */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
              border: 0, boxShadow: 'var(--neu-subtle)', '&:hover': { bgcolor: 'rgba(116,144,154,0.08)' },
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
                color: TONES.maroon.text, borderColor: 'rgba(185,138,138,0.3)', textTransform: 'none',
                border: 0, boxShadow: 'var(--neu-subtle)', '&:hover': { bgcolor: 'rgba(185,138,138,0.08)' },
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
                border: 0, boxShadow: 'var(--neu-subtle)', '&:hover': { bgcolor: 'rgba(192,107,88,0.08)' },
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
  const [error, setError] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    api.get<{ items: AdminSubscription[] }>('/subscriptions')
      .then((response) => {
        if (!cancelled) setSubscriptions(response.items ?? [])
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Could not load subscriptions')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const totalSubscribers = subscriptions.length
  const paidUsers = subscriptions.filter((subscription) => subscription.tier !== SubscriptionTier.FREE).length
  const freeUsers = totalSubscribers - paidUsers
  const monthlyRevenue = subscriptions
    .filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE && subscription.tier !== SubscriptionTier.FREE)
    .reduce((sum, subscription) => {
      const plan = SUBSCRIPTION_PLANS[subscription.tier]
      return sum + (subscription.billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly / 12)
    }, 0)
  const revenueByTier = Object.values(SubscriptionTier).filter((tier) => tier !== SubscriptionTier.FREE).map((tier) => {
    const active = subscriptions.filter((subscription) => subscription.tier === tier && subscription.status === SubscriptionStatus.ACTIVE)
    const revenue = active.reduce((sum, subscription) => {
      const plan = SUBSCRIPTION_PLANS[subscription.tier]
      return sum + (subscription.billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly / 12)
    }, 0)
    return { tier, name: SUBSCRIPTION_PLANS[tier].name, count: active.length, revenue, color: tierColors[tier] }
  })
  const totalRevForBar = Math.max(1, revenueByTier.reduce((sum, row) => sum + row.revenue, 0))

  const filtered = subscriptions.filter(s => {
    if (tierFilter !== 'all' && s.tier !== tierFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.userName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  if (error) {
    return <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState title="Could not load subscriptions" description={error} /></Box>
  }

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="gold"
        eyebrow="Community"
        title="Subscriptions"
        lede="Monitor plan mix, billing health, and recurring revenue across every subscriber."
        icon={<WorkspacePremiumRoundedIcon />}
        stats={[
          { label: 'Total Subscribers', value: loading ? <Skeleton width={60} /> : totalSubscribers },
          { label: 'Monthly Revenue', value: loading ? <Skeleton width={90} /> : `GH₵ ${monthlyRevenue.toFixed(0)}` },
          { label: 'Free Users', value: loading ? <Skeleton width={60} /> : freeUsers },
          { label: 'Paid Users', value: loading ? <Skeleton width={60} /> : paidUsers },
        ]}
      />

      {/* Revenue breakdown by tier */}
      <Box sx={{ ...raisedSurface, mb: 3, px: 3, py: 2 }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
          Revenue by Tier
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {revenueByTier.map((r) => (
            <Box key={r.tier} sx={{ ...insetSurface, p: 2, flex: 1, minWidth: 140, }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: r.color, fontWeight: 700 }}>{r.name}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: '"Outfit", monospace' }}>
                  {loading ? <Skeleton width={90} /> : `GH₵ ${r.revenue.toFixed(0)}/mo`}
                </Typography>
              </Box>
              <Box sx={{ ...progressTrack }}>
                <Box sx={{
                  width: `${(r.revenue / totalRevForBar) * 100}%`,
                  height: '100%', bgcolor: r.color, transformOrigin: 'left',
                }} />
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.3 }}>
                {loading ? <Skeleton width={70} /> : `${r.count} subscriber${r.count !== 1 ? 's' : ''}`}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, ...raisedSurface, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search subscribers..."
            slotProps={{ htmlInput: { 'aria-label': 'Search subscribers...' } }}
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
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            select size="small" variant="outlined" label="Tier"
            value={tierFilter} onChange={e => setTierFilter(e.target.value)} fullWidth
          >
            <MenuItem value="all">All Tiers</MenuItem>
            {Object.values(SubscriptionTier).map(t => (
              <MenuItem key={t} value={t}>{SUBSCRIPTION_PLANS[t].name}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            select size="small" variant="outlined" label="Status"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)} fullWidth
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(SubscriptionStatus).map(s => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'text.secondary' }}>
            {loading ? <Skeleton width={100} /> : `${filtered.length} subscription${filtered.length !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
      </Box>

      {/* Table header */}
      <Box sx={{
        display: { xs: 'none', md: 'grid' },
        gridTemplateColumns: '2fr 0.9fr 0.8fr 0.8fr 1.1fr 1.1fr 2fr',
        gap: 2, px: 3, py: 1.2, mb: 2,
        ...raisedSurface,
        bgcolor: 'background.paper',
      }}>
        {['User', 'Tier', 'Status', 'Billing', 'Period Start', 'Period End', 'Actions'].map(h => (
          <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      <Box sx={{ display: 'grid', gap: 2 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          : pagination.page.map((sub) => (
              <SubscriptionRow key={sub.id} sub={sub} />
            ))
        }
      </Box>

      {!loading && <PaginationBar neumorphic pagination={pagination} accentColor={TONES.maroon.text} />}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState variant="search" title="No subscriptions found" description="No subscriptions match your filters. Try adjusting your search criteria." compact /></Box>
      )}
    </Box>
  )
}
