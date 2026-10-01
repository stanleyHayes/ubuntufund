import TextField from '@/components/AdminTextField'
import ExportMenu from '@/components/ExportMenu'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Skeleton, Box, Typography, MenuItem, InputAdornment, Button, ListItemText } from '@mui/material'
import { raisedSurface, insetSurface, progressTrack } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import { EmptyState } from '@ubuntu-fund/ui'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  SubscriptionTier,
  SubscriptionStatus,
} from '@ubuntu-fund/types'
import type { Subscription } from '@ubuntu-fund/types'
import { useAdminPlans } from '@/hooks/useApiData'
import { buildPlanMap, knownTiers, planName, summarize, type PlanMap } from '@/lib/subscriptionMetrics'
import { formatPesewas } from '@/lib/money'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'
import { loadAll } from '@/lib/exports/loadAll'
import { TONES } from '@/lib/tones'


// ---------------------------------------------------------------------------
// Tier colors
// ---------------------------------------------------------------------------
// Curated colours for built-in tiers; any other (admin-added) tier falls back
// to a neutral. String-keyed so a custom tier id never breaks the lookup.
const tierColors: Record<string, string> = {
  [SubscriptionTier.FREE]: '#78909C',
  [SubscriptionTier.STARTER]: '#74909A',
  [SubscriptionTier.PRO]: TONES.maroon.text,
  [SubscriptionTier.ORGANIZATION]: '#8B6F4E',
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

// Tier cards (and their skeleton, which keeps the same structure).
const tierCardSx = {
  ...insetSurface,
  border: 'var(--neu-border)',
  backdropFilter: 'var(--neu-backdrop)',
  WebkitBackdropFilter: 'var(--neu-backdrop)',
  p: 2, flex: 1, minWidth: 140,
}

function TierCardSkeleton() {
  return (
    <Box sx={tierCardSx}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Skeleton width={80} />
        <Skeleton width={90} />
      </Box>
      <Skeleton variant="rounded" height={10} />
      <Skeleton width={70} sx={{ mt: 0.3 }} />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SubscriptionRow
// ---------------------------------------------------------------------------
function SubscriptionRow({ sub, plans, plansLoading, now }: { sub: AdminSubscription; plans: PlanMap; plansLoading: boolean; now: Date }) {
  const navigate = useNavigate()
  const tierColor = tierColors[sub.tier] ?? '#78909C'
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
            {plansLoading ? <Skeleton width={56} /> : planName(sub.tier, plans)}
          </Typography>
        </Box>
      </Box>

      {/* Status */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
          {sub.status.replace('_', ' ')}
          {sub.status === SubscriptionStatus.ACTIVE && new Date(sub.currentPeriodEnd).getTime() <= now.getTime() && ' · period ended'}
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
    loadAll<AdminSubscription>('/subscriptions')
      .then((response) => {
        if (!cancelled) setSubscriptions(response)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Could not load subscriptions')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Prices and names come from the live plans only: while they load the page
  // shows skeletons, and if they fail it says so rather than guessing.
  const { data: livePlans, isLoading: plansLoading, error: plansError, retry: retryPlans } = useAdminPlans()
  const plans = useMemo(() => buildPlanMap(livePlans), [livePlans])
  // One clock per page load, so every figure and row agrees on "now".
  const [now] = useState(() => new Date())
  const summary = useMemo(() => summarize(subscriptions, plans, now), [subscriptions, plans, now])
  const tierOptions = useMemo(() => knownTiers(plans, subscriptions), [plans, subscriptions])
  /** Revenue figure for the header and cards: unavailable (not zero) when plan prices failed to load. */
  const revenue = (pesewas: number, suffix = '') => (plansError ? '—' : `${formatPesewas(pesewas)}${suffix}`)
  const revenueByTier = summary.byTier.map(row => ({
    ...row,
    color: tierColors[row.tier] ?? plans[row.tier]?.accentColor ?? '#78909C',
    // A sales-only plan's price is only a reference, so its card states no amount.
    amount: row.negotiated ? 'Negotiated' : revenue(row.revenuePesewas, '/mo'),
  }))
  const totalRevForBar = Math.max(1, summary.estimatedMrrPesewas)

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
          { label: 'Total Subscribers', value: loading ? <Skeleton width={60} /> : summary.total },
          { label: 'Estimated MRR (list price)', value: loading || plansLoading ? <Skeleton width={90} /> : revenue(summary.estimatedMrrPesewas) },
          { label: 'Free or lapsed', value: loading ? <Skeleton width={60} /> : summary.free },
          { label: 'Paying now', value: loading ? <Skeleton width={60} /> : summary.paid },
        ]}
      actions={<ExportMenu title="Subscriptions" disabled={loading || !!error} getReport={() => ({ title: "Subscriptions", filters: [`Tier: ${tierFilter}`, `Status: ${statusFilter}`, `Search: ${search || 'All'}`], tables: [exportTable("Subscriptions", filtered, { ID: r => r.id, Member: r => r.userName, Email: r => r.email, Tier: r => r.tier, Status: r => r.status, Provider: r => r.billingProvider ?? 'web', Cycle: r => r.billingCycle, 'Period end (UTC)': r => dateCell(r.currentPeriodEnd) })] })} />}
      />


      <Alert severity="info" sx={{ mb: 3 }}>
        Estimates use current plan list prices for web-billed subscriptions that are active and inside their paid period. Discounts are not reflected, and this is not money collected.
        {summary.storeBilledPaid > 0 && ` ${summary.storeBilledPaid} paying subscriber${summary.storeBilledPaid === 1 ? ' is' : 's are'} billed by the App Store or Google Play and not priced here.`}
        {summary.negotiatedPaid > 0 && ` ${summary.negotiatedPaid} paying subscriber${summary.negotiatedPaid === 1 ? ' is on a sales-only plan at a negotiated price' : 's are on sales-only plans at negotiated prices'} and not priced here.`}
        {' '}Change or cancel a subscription through its billing provider; this console has no subscription controls.
      </Alert>

      {plansError && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={retryPlans}>Retry</Button>}>
          Plan prices could not be loaded, so estimated revenue is unavailable and tiers show their ids. {plansError}
        </Alert>
      )}

      {/* Revenue breakdown by tier */}
      <Box sx={{ ...raisedSurface, mb: 3, px: 3, py: 2 }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
          Estimated monthly revenue by tier (list price)
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {plansLoading ? Array.from({ length: 4 }).map((_, i) => <TierCardSkeleton key={i} />) : revenueByTier.map((r) => (
            <Box key={r.tier} sx={tierCardSx}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: r.color, fontWeight: 700 }}>{r.name}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: '"Outfit", monospace', whiteSpace: 'nowrap' }}>
                  {loading ? <Skeleton width={90} /> : r.amount}
                </Typography>
              </Box>
              <Box sx={{ ...progressTrack }}>
                <Box sx={{
                  width: `${(r.revenuePesewas / totalRevForBar) * 100}%`,
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
          <TextField optionContext="subscription"
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
          <TextField optionContext="subscription"
            select size="small" variant="outlined" label="Tier"
            value={tierFilter} onChange={e => setTierFilter(e.target.value)} fullWidth
            disabled={plansLoading}
          >
            <MenuItem value="all">All Tiers</MenuItem>
            {tierOptions.map(t => (
              <MenuItem key={t} value={t}><ListItemText primary={planName(t, plans)} secondary={`Members on the ${planName(t, plans)} plan.`} /></MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField optionContext="subscription"
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
              <SubscriptionRow key={sub.id} sub={sub} plans={plans} plansLoading={plansLoading} now={now} />
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
