import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { keyframes } from '@emotion/react'
import {
  formatCurrency,
  SHAPE,
  EmptyState,
  ErrorState,
  NEUMORPHIC_FOREST_VARS,
} from '@ubuntu-fund/ui'
import type {
  AffiliateReferral,
  AffiliateReferralStatus,
  AffiliateCommission,
  AffiliateCommissionStatus,
} from '@ubuntu-fund/types'
import { useAffiliate } from '@/hooks/useAffiliate'
import { listReferrals, listCommissions, requestPayout } from '@/lib/affiliate'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: Date | string | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const REFERRAL_STATUS_STYLE: Record<AffiliateReferralStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: 'rgba(255,167,38,0.12)', color: 'var(--text-warning)' },
  converted: { label: 'Converted', bg: 'rgba(46, 61, 47,0.1)', color: 'var(--text-brand)' },
}

const COMMISSION_STATUS_STYLE: Record<AffiliateCommissionStatus, { label: string; bg: string; color: string }> = {
  held: { label: 'Held', bg: 'rgba(255,167,38,0.12)', color: 'var(--text-warning)' },
  available: { label: 'Available', bg: 'rgba(46, 61, 47,0.1)', color: 'var(--text-brand)' },
  paid: { label: 'Paid out', bg: 'rgba(21,101,192,0.1)', color: 'var(--text-info)' },
  reversed: { label: 'Reversed', bg: 'rgba(239,83,80,0.1)', color: 'var(--text-error)' },
  cancelled: { label: 'Cancelled', bg: 'rgba(120,144,156,0.14)', color: 'var(--text-secondary)' },
}

// ---------------------------------------------------------------------------
// Stat Card — mirrors the dashboard's neumorphic stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
  delay: number
}

function StatCard({ icon, iconColor, label, value, delay }: StatCardProps) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-raised)',
        transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s cubic-bezier(0.22,1,0.36,1)',
        animation: `${fadeInUp} 0.5s ${delay}s ease both`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 'var(--neu-raised-hover)',
        },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: SHAPE.sm,
          bgcolor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          mb: 2,
        }}
      >
        {icon}
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
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{label}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Referral list row
// ---------------------------------------------------------------------------

function ReferralRow({ referral, index }: { referral: AffiliateReferral; index: number }) {
  const style = REFERRAL_STATUS_STYLE[referral.status] ?? REFERRAL_STATUS_STYLE.pending
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.5,
        boxShadow: '0 8px 14px -14px rgba(38,55,44,0.35)',
        animation: `${fadeInUp} 0.3s ${0.05 * index + 0.1}s ease both`,
        '&:last-of-type': { boxShadow: 'none' },
      }}
    >
      <Avatar
        sx={{
          width: 34,
          height: 34,
          fontSize: '0.7rem',
          fontWeight: 700,
          bgcolor: 'rgba(46, 61, 47,0.1)',
          color: 'var(--text-brand)',
        }}
      >
        {referral.referralCode?.[0]?.toUpperCase() ?? 'R'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary' }}>
            Referred signup
          </Typography>
          <Chip
            label={style.label}
            size="small"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: style.bg, color: style.color, flexShrink: 0, '& .MuiChip-label': { px: 1 } }}
          />
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
          Joined {formatDate(referral.createdAt)}
          {referral.convertedAt ? ` · Converted ${formatDate(referral.convertedAt)}` : ''}
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Commission list row
// ---------------------------------------------------------------------------

function CommissionRow({ commission, index }: { commission: AffiliateCommission; index: number }) {
  const style = COMMISSION_STATUS_STYLE[commission.status] ?? COMMISSION_STATUS_STYLE.held
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.5,
        boxShadow: '0 8px 14px -14px rgba(38,55,44,0.35)',
        animation: `${fadeInUp} 0.3s ${0.05 * index + 0.1}s ease both`,
        '&:last-of-type': { boxShadow: 'none' },
      }}
    >
      <Avatar
        sx={{
          width: 34,
          height: 34,
          bgcolor: 'rgba(199, 162, 74,0.12)',
          color: 'var(--text-warning)',
        }}
      >
        <ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: '"Outfit", monospace',
              fontSize: '0.9rem',
              fontWeight: 800,
              color: 'primary.dark',
            }}
          >
            {formatCurrency(commission.amount, commission.currency)}
          </Typography>
          <Chip
            label={style.label}
            size="small"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: style.bg, color: style.color, flexShrink: 0, '& .MuiChip-label': { px: 1 } }}
          />
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
          {commission.commissionRate}% commission · {formatDate(commission.createdAt)}
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// List panel wrapper
// ---------------------------------------------------------------------------

function ListPanel({
  title,
  count,
  delay,
  children,
}: {
  title: string
  count?: number
  delay: number
  children: React.ReactNode
}) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-raised)',
        height: '100%',
        animation: `${fadeInUp} 0.5s ${delay}s ease both`,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
        {typeof count === 'number' && count > 0 && (
          <Chip
            label={count}
            size="small"
            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(46, 61, 47,0.08)', color: 'var(--text-brand)', '& .MuiChip-label': { px: 1 } }}
          />
        )}
      </Box>
      {children}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// AffiliateDashboardPage
// ---------------------------------------------------------------------------

export function AffiliateDashboardPage() {
  const { dashboard, enrolled, isLoading, isEnrolling, error, enroll, refresh } = useAffiliate()

  const [referrals, setReferrals] = useState<AffiliateReferral[]>([])
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([])
  const [listsLoading, setListsLoading] = useState(false)
  const [listsKey, setListsKey] = useState(0)

  const [copied, setCopied] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [payoutSuccess, setPayoutSuccess] = useState(false)

  // Load the referral + commission ledgers once enrolled (and after a payout).
  useEffect(() => {
    if (!enrolled) {
      setReferrals([])
      setCommissions([])
      return
    }
    let cancelled = false
    setListsLoading(true)

    Promise.all([listReferrals(), listCommissions()])
      .then(([refs, comms]) => {
        if (cancelled) return
        setReferrals(refs)
        setCommissions(comms)
      })
      .catch(() => {
        // Non-fatal — the dashboard stats still render; lists stay empty.
        if (!cancelled) {
          setReferrals([])
          setCommissions([])
        }
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enrolled, listsKey])

  const handleCopy = useCallback(async () => {
    if (!dashboard) return
    try {
      await navigator.clipboard.writeText(dashboard.referralLink)
      setCopied(true)
    } catch {
      setCopied(true)
    }
  }, [dashboard])

  const handleRequestPayout = useCallback(async () => {
    const available = dashboard?.stats.availableBalance ?? 0
    if (available <= 0) return
    setPayoutLoading(true)
    setPayoutError(null)
    try {
      await requestPayout(available)
      setPayoutSuccess(true)
      refresh()
      setListsKey((k) => k + 1)
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'We could not request your payout. Please try again.')
    } finally {
      setPayoutLoading(false)
    }
  }, [dashboard, refresh])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'center', py: 12 }}>
          <LinearProgress sx={{ borderRadius: 2, mb: 2 }} />
          <Typography sx={{ color: 'text.secondary' }}>Loading your affiliate dashboard…</Typography>
        </Box>
      </Container>
    )
  }

  // ── Error (only when we have no dashboard to show) ───────────────────────────
  if (error && !enrolled) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <ErrorState
          title="Couldn't load your affiliate dashboard"
          message={error}
          onRetry={refresh}
        />
      </Container>
    )
  }

  // ── Not enrolled → enroll CTA ────────────────────────────────────────────────
  if (!enrolled || !dashboard) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <EmptyState
          variant="empty"
          title="Earn by referring others to Ujimora"
          description="Join the affiliate program to get your own referral link. Earn a commission every time someone you refer starts a paid subscription."
          action={
            <Button
              variant="contained"
              onClick={() => void enroll()}
              disabled={isEnrolling}
              startIcon={isEnrolling ? <CircularProgress size={16} color="inherit" /> : <HandshakeRoundedIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: SHAPE.sm,
                px: 3,
                py: 1.2,
                fontFamily: '"Outfit", sans-serif',
                background: 'linear-gradient(135deg, #5E8F72, #2E3D2F)',
                '&:hover': { background: 'linear-gradient(135deg, #2E3D2F, #1C261D)' },
              }}
            >
              {isEnrolling ? 'Enrolling…' : 'Join the affiliate program'}
            </Button>
          }
        />
        {error && (
          <Box sx={{ maxWidth: 480, mx: 'auto', mt: 2 }}>
            <Alert severity="error" sx={{ borderRadius: SHAPE.sm }}>{error}</Alert>
          </Box>
        )}
      </Container>
    )
  }

  // ── Enrolled dashboard ───────────────────────────────────────────────────────
  const { stats, affiliate, referralLink } = dashboard
  const canRequestPayout = stats.availableBalance > 0

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero header */}
      <Box
        sx={{
          ...NEUMORPHIC_FOREST_VARS,
          position: 'relative',
          overflow: 'hidden',
          pt: { xs: 4, md: 5 },
          pb: { xs: 5, md: 6 },
          bgcolor: '#0D1F0D',
        }}
      >
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
          <Box sx={{ animation: `${fadeInUp} 0.5s ease both` }}>
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
              Affiliate{' '}
              <Box component="span" sx={{ color: 'var(--text-success)' }}>
                Program
              </Box>
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              Share your link, grow the community, and earn commission on every referral.
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -3, pb: 6, position: 'relative', zIndex: 2 }}>
        {/* Referral link + payout */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Referral link */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              sx={{
                p: 3,
                borderRadius: SHAPE.card,
                bgcolor: 'background.paper',
                boxShadow: 'var(--neu-raised)',
                height: '100%',
                animation: `${fadeInUp} 0.5s 0.05s ease both`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Your referral link</Typography>
                <Chip
                  label={affiliate.referralCode}
                  size="small"
                  sx={{
                    height: 22,
                    fontFamily: '"Outfit", monospace',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(199, 162, 74,0.12)',
                    color: 'var(--text-warning)',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  pl: 2,
                  borderRadius: SHAPE.sm,
                  bgcolor: 'var(--neu-surface)',
                  boxShadow: 'var(--neu-inset)',
                }}
              >
                <Typography
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '0.85rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {referralLink}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
                  <IconButton
                    onClick={handleCopy}
                    size="small"
                    sx={{ color: copied ? 'success.main' : 'primary.main', flexShrink: 0 }}
                  >
                    {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Grid>

          {/* Payout action */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                p: 3,
                borderRadius: SHAPE.card,
                bgcolor: 'background.paper',
                boxShadow: 'var(--neu-raised)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                animation: `${fadeInUp} 0.5s 0.1s ease both`,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>Available to withdraw</Typography>
                <Typography
                  sx={{
                    fontFamily: '"Outfit", sans-serif',
                    fontWeight: 900,
                    fontSize: '1.6rem',
                    color: 'primary.dark',
                    lineHeight: 1,
                  }}
                >
                  {formatCurrency(stats.availableBalance, 'GHS')}
                </Typography>
              </Box>
              <Button
                variant="contained"
                fullWidth
                onClick={handleRequestPayout}
                disabled={!canRequestPayout || payoutLoading}
                startIcon={payoutLoading ? <CircularProgress size={16} color="inherit" /> : <PaymentsRoundedIcon />}
                sx={{
                  mt: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: SHAPE.sm,
                  fontFamily: '"Outfit", sans-serif',
                  background: 'linear-gradient(135deg, #5E8F72, #2E3D2F)',
                  '&:hover': { background: 'linear-gradient(135deg, #2E3D2F, #1C261D)' },
                  '&.Mui-disabled': { background: 'rgba(0,0,0,0.08)', color: 'text.disabled' },
                }}
              >
                {payoutLoading ? 'Requesting…' : 'Request payout'}
              </Button>
              {!canRequestPayout && (
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mt: 1, textAlign: 'center' }}>
                  Commission becomes available after its hold window.
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {payoutError && (
          <Alert severity="error" onClose={() => setPayoutError(null)} sx={{ mb: 3, borderRadius: SHAPE.sm }}>
            {payoutError}
          </Alert>
        )}

        {/* Earnings stat cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<SavingsRoundedIcon sx={{ fontSize: 22 }} />}
              iconColor="#2E3D2F"
              label="Total Earned"
              value={formatCurrency(stats.totalEarned, 'GHS')}
              delay={0.15}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<AccountBalanceWalletRoundedIcon sx={{ fontSize: 22 }} />}
              iconColor="#1565C0"
              label="Available"
              value={formatCurrency(stats.availableBalance, 'GHS')}
              delay={0.2}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<HourglassEmptyRoundedIcon sx={{ fontSize: 22 }} />}
              iconColor="#A07E33"
              label="Pending"
              value={formatCurrency(stats.pendingBalance, 'GHS')}
              delay={0.25}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<PaymentsRoundedIcon sx={{ fontSize: 22 }} />}
              iconColor="#6A1B9A"
              label="Paid Out"
              value={formatCurrency(stats.paidOutBalance, 'GHS')}
              delay={0.3}
            />
          </Grid>
        </Grid>

        {/* Referrals + commissions */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListPanel title="Referrals" count={referrals.length} delay={0.35}>
              {listsLoading ? (
                <Box sx={{ py: 3 }}>
                  <LinearProgress sx={{ borderRadius: 2 }} />
                </Box>
              ) : referrals.length === 0 ? (
                <EmptyState
                  variant="noData"
                  compact
                  icon={<PeopleRoundedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />}
                  title="No referrals yet"
                  description="Share your link to start referring people to Ujimora."
                />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {referrals.map((r, i) => (
                    <ReferralRow key={r.id} referral={r} index={i} />
                  ))}
                </Box>
              )}
            </ListPanel>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ListPanel title="Commissions" count={commissions.length} delay={0.4}>
              {listsLoading ? (
                <Box sx={{ py: 3 }}>
                  <LinearProgress sx={{ borderRadius: 2 }} />
                </Box>
              ) : commissions.length === 0 ? (
                <EmptyState
                  variant="noData"
                  compact
                  icon={<ReceiptLongRoundedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />}
                  title="No commissions yet"
                  description="You'll earn a commission when a referred user starts a paid subscription."
                />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {commissions.map((c, i) => (
                    <CommissionRow key={c.id} commission={c} index={i} />
                  ))}
                </Box>
              )}
            </ListPanel>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Referral link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      <Snackbar
        open={payoutSuccess}
        autoHideDuration={4000}
        onClose={() => setPayoutSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setPayoutSuccess(false)} sx={{ borderRadius: SHAPE.sm }}>
          Payout requested — you'll be notified once it's processed.
        </Alert>
      </Snackbar>
    </Box>
  )
}
