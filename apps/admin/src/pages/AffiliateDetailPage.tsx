import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Typography, Breadcrumbs, Link, Skeleton, Alert,
} from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { EmptyState, ItemNotFound } from '@ubuntu-fund/ui'
import { AffiliateStatus } from '@ubuntu-fund/types'
import type {
  Affiliate,
  AffiliateBalance,
  AffiliateStats,
  AffiliateReferral,
  AffiliateCommission,
  AffiliatePayout,
  AffiliateCommissionStatus,
  AffiliateReferralStatus,
  PayoutStatus,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import { TONES } from '@/lib/tones'

/** Mirrors the API's GetAffiliateDetailUseCase.AffiliateDetailView. */
interface AffiliateDetailView {
  affiliate: Affiliate
  balance: AffiliateBalance
  stats: AffiliateStats
  referrals: AffiliateReferral[]
  commissions: AffiliateCommission[]
  payouts: AffiliatePayout[]
}

const affiliateStatusColors: Record<AffiliateStatus, string> = {
  [AffiliateStatus.ACTIVE]: TONES.green.text,
  [AffiliateStatus.SUSPENDED]: TONES.clay.text,
}

const referralStatusColors: Record<AffiliateReferralStatus, string> = {
  pending: TONES.gold.text,
  converted: TONES.green.text,
}

const commissionStatusColors: Record<AffiliateCommissionStatus, string> = {
  held: TONES.gold.text,
  available: TONES.green.text,
  paid: TONES.teal.text,
  reversed: TONES.maroon.text,
  cancelled: TONES.clay.text,
}

const payoutStatusColors: Record<PayoutStatus, string> = {
  PENDING: TONES.gold.text,
  PROCESSING: TONES.teal.text,
  PAID: TONES.green.text,
  FAILED: TONES.clay.text,
  REVERSED: TONES.maroon.text,
}

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id)
const formatMoney = (amount: number, currency = 'GHS') =>
  `${currency === 'GHS' ? 'GH₵' : currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDate = (value?: Date | string) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.3, ...insetSurface }}>
      <Box sx={{ width: 6, height: 6, bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'capitalize' }}>{label}</Typography>
    </Box>
  )
}

function SectionCard({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <Box sx={{ ...raisedSurface, p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', color: TONES.green.text, '& svg': { fontSize: 20 } }}>{icon}</Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{title}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 0.5 }}>({count})</Typography>
      </Box>
      {children}
    </Box>
  )
}

export default function AffiliateDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<AffiliateDetailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!id) {
      setLoading(false)
      return
    }
    api.get<AffiliateDetailView>(`/affiliates/${id}`)
      .then((result) => { if (!cancelled) setDetail(result) })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load affiliate.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Skeleton variant="text" width={220} height={20} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={360} height={40} sx={{ mb: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Box>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={220} sx={{ mb: 3 }} />
        ))}
      </Box>
    )
  }

  if (!detail) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}
        <ItemNotFound itemType="Affiliate" onBack={() => navigate('/affiliates')} backLabel="Back to Affiliates" />
      </Box>
    )
  }

  const { affiliate, balance, stats, referrals, commissions, payouts } = detail

  const REFERRAL_GRID = '1.5fr 1fr 1fr'
  const COMMISSION_GRID = '1fr 1fr 0.9fr 1fr 1fr'
  const PAYOUT_GRID = '1fr 1fr 1fr 1fr'

  const headerCell = { fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }
  const bodyCell = { fontSize: '0.78rem', color: 'text.secondary' }
  const rowSx = (grid: string) => ({
    display: { xs: 'none', md: 'grid' }, gridTemplateColumns: grid, gap: 2,
    alignItems: 'center', px: 2, py: 1.5, ...insetSurface, mb: 1,
  })
  const headSx = (grid: string) => ({
    display: { xs: 'none', md: 'grid' }, gridTemplateColumns: grid, gap: 2, px: 2, py: 1, mb: 1,
  })

  return (
    <Box sx={{ p: { xs: 0, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
        <Link underline="hover" color="text.secondary" sx={{ cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => navigate('/affiliates')}>
          Affiliates
        </Link>
        <Typography sx={{ fontSize: '0.85rem', fontFamily: '"Outfit", monospace' }}>{affiliate.referralCode}</Typography>
      </Breadcrumbs>

      <PageHeader
        tone="green"
        eyebrow="Growth · Affiliate"
        title={affiliate.referralCode}
        lede={`Referral partner for user ${shortId(affiliate.userId)}.`}
        icon={<HandshakeRoundedIcon />}
        actions={<StatusPill label={affiliate.status} color={affiliateStatusColors[affiliate.status]} />}
        stats={[
          { label: 'Commission Rate', value: `${affiliate.commissionRate}%` },
          { label: 'Total Earned', value: formatMoney(stats.totalEarned, balance.currency) },
          { label: 'Available', value: formatMoney(stats.availableBalance, balance.currency) },
          { label: 'Pending', value: formatMoney(stats.pendingBalance, balance.currency) },
        ]}
      />

      {/* Secondary stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {[
          { label: 'Total Referrals', value: stats.totalReferrals },
          { label: 'Converted', value: stats.convertedReferrals },
          { label: 'Pending Referrals', value: stats.pendingReferrals },
          { label: 'Paid Out', value: formatMoney(stats.paidOutBalance, balance.currency) },
        ].map((s) => (
          <Box key={s.label} sx={{ ...raisedSurface, px: 2.5, py: 2 }}>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: TONES.green.text, lineHeight: 1.2, fontFamily: '"Outfit", monospace' }}>{s.value}</Typography>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Payout recipient */}
      <Box sx={{ ...raisedSurface, p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ display: 'flex', color: TONES.green.text, '& svg': { fontSize: 20 } }}><PaymentsRoundedIcon /></Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Payout Recipient</Typography>
        </Box>
        {affiliate.accountName ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            <Box><Typography variant="caption" color="text.secondary">Account Name</Typography><Typography sx={{ fontSize: '0.85rem' }}>{affiliate.accountName}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Account Number</Typography><Typography sx={{ fontSize: '0.85rem', fontFamily: '"Outfit", monospace' }}>{affiliate.accountNumber ?? '—'}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Bank / Telco Code</Typography><Typography sx={{ fontSize: '0.85rem', fontFamily: '"Outfit", monospace' }}>{affiliate.bankCode ?? '—'}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Type</Typography><Typography sx={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{(affiliate.recipientType ?? '—').replace('_', ' ')}</Typography></Box>
          </Box>
        ) : (
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>No payout recipient registered yet.</Typography>
        )}
      </Box>

      {/* Referrals */}
      <SectionCard title="Referrals" icon={<GroupsRoundedIcon />} count={referrals.length}>
        {referrals.length === 0 ? (
          <EmptyState title="No referrals" description="This affiliate has not referred any signups yet." compact />
        ) : (
          <>
            <Box sx={headSx(REFERRAL_GRID)}>
              {['Referred User', 'Status', 'Converted'].map((h) => <Typography key={h} sx={headerCell}>{h}</Typography>)}
            </Box>
            {referrals.map((r) => (
              <Box key={r.id} sx={rowSx(REFERRAL_GRID)}>
                <Typography sx={{ ...bodyCell, fontFamily: '"Outfit", monospace' }}>{shortId(r.refereeId)}</Typography>
                <Box><StatusPill label={r.status} color={referralStatusColors[r.status]} /></Box>
                <Typography sx={bodyCell}>{r.status === 'converted' ? formatDate(r.convertedAt) : '—'}</Typography>
              </Box>
            ))}
          </>
        )}
      </SectionCard>

      {/* Commissions */}
      <SectionCard title="Commissions" icon={<ReceiptLongRoundedIcon />} count={commissions.length}>
        {commissions.length === 0 ? (
          <EmptyState title="No commissions" description="Commissions accrue when a referred user's first subscription payment settles." compact />
        ) : (
          <>
            <Box sx={headSx(COMMISSION_GRID)}>
              {['Amount', 'Rate', 'Status', 'Matures', 'Earned'].map((h) => <Typography key={h} sx={headerCell}>{h}</Typography>)}
            </Box>
            {commissions.map((c) => (
              <Box key={c.id} sx={rowSx(COMMISSION_GRID)}>
                <Typography sx={{ ...bodyCell, fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>{formatMoney(c.amount, c.currency)}</Typography>
                <Typography sx={bodyCell}>{c.commissionRate}%</Typography>
                <Box><StatusPill label={c.status} color={commissionStatusColors[c.status]} /></Box>
                <Typography sx={bodyCell}>{formatDate(c.maturesAt)}</Typography>
                <Typography sx={bodyCell}>{formatDate(c.createdAt)}</Typography>
              </Box>
            ))}
          </>
        )}
      </SectionCard>

      {/* Payout history */}
      <SectionCard title="Payout History" icon={<PaymentsRoundedIcon />} count={payouts.length}>
        {payouts.length === 0 ? (
          <EmptyState title="No payouts" description="Disbursements of accrued commission will appear here." compact />
        ) : (
          <>
            <Box sx={headSx(PAYOUT_GRID)}>
              {['Amount', 'Status', 'Requested', 'Reference'].map((h) => <Typography key={h} sx={headerCell}>{h}</Typography>)}
            </Box>
            {payouts.map((p) => (
              <Box key={p.id} sx={rowSx(PAYOUT_GRID)}>
                <Typography sx={{ ...bodyCell, fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>{formatMoney(p.amount, p.currency)}</Typography>
                <Box><StatusPill label={p.status.toLowerCase()} color={payoutStatusColors[p.status]} /></Box>
                <Typography sx={bodyCell}>{formatDate(p.createdAt)}</Typography>
                <Typography sx={{ ...bodyCell, fontFamily: '"Outfit", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.providerRef ?? '—'}</Typography>
              </Box>
            ))}
          </>
        )}
      </SectionCard>

      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textAlign: 'center', mt: 2 }}>
        Enrolled {formatDate(affiliate.createdAt)} · Last updated {formatDate(affiliate.updatedAt)}
      </Typography>
    </Box>
  )
}
