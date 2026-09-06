import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import { keyframes } from '@emotion/react'
import { SHAPE, formatCurrency } from '@ubuntu-fund/ui'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  SUBSCRIPTION_PLANS,
} from '@ubuntu-fund/types'
import { useMySubscription, usePlanMap } from '@/hooks/useSubscription'
import { api } from '@/lib/api'
import {
  createSubscriptionCheckout,
  saveSubscriptionCheckoutHandoff,
  isPaymentsNotConfigured,
} from '@/lib/subscriptions'
import { useCouponPreview } from '@/hooks/useCouponPreview'

// ─── Animations ─────────────────────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_ORDER = [SubscriptionTier.FREE, SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]

const TIER_COLORS: Record<SubscriptionTier, { accent: string; bg: string; banner: string }> = {
  [SubscriptionTier.FREE]: { accent: '#78909C', bg: 'rgba(120,144,156,0.06)', banner: '#78909C' },
  [SubscriptionTier.STARTER]: { accent: 'var(--text-info)', bg: 'rgba(21,101,192,0.05)', banner: '#1565C0' },
  [SubscriptionTier.PRO]: { accent: 'var(--text-brand)', bg: 'rgba(46, 61, 47,0.05)', banner: '#2E3D2F' },
  [SubscriptionTier.ENTERPRISE]: { accent: 'var(--text-accent)', bg: 'rgba(106,27,154,0.05)', banner: '#6A1B9A' },
}

interface FeatureRow {
  label: string
  key: keyof (typeof SUBSCRIPTION_PLANS)[SubscriptionTier.FREE]
  format?: 'boolean' | 'number' | 'fee' | 'goal' | 'unlimited'
}

const FEATURE_SECTIONS: { title: string; rows: FeatureRow[] }[] = [
  {
    title: 'Campaigns',
    rows: [
      { label: 'Active campaigns', key: 'maxActiveCampaigns', format: 'unlimited' },
      { label: 'Max campaign goal', key: 'maxCampaignGoal', format: 'goal' },
      { label: 'Media uploads per campaign', key: 'maxMediaPerCampaign', format: 'unlimited' },
      { label: 'Featured listing', key: 'featuredListing', format: 'boolean' },
    ],
  },
  {
    title: 'Pricing',
    rows: [
      { label: 'Platform fee', key: 'platformFeePercent', format: 'fee' },
    ],
  },
  {
    title: 'Features',
    rows: [
      { label: 'Priority support', key: 'prioritySupport', format: 'boolean' },
      { label: 'Advanced analytics', key: 'advancedAnalytics', format: 'boolean' },
      { label: 'Custom branding', key: 'customBranding', format: 'boolean' },
      { label: 'Escrow & milestones', key: 'escrowSupport', format: 'boolean' },
      { label: 'Live streaming', key: 'liveStreaming', format: 'boolean' },
    ],
  },
  {
    title: 'Team',
    rows: [
      { label: 'Team members', key: 'maxTeamMembers', format: 'unlimited' },
      { label: 'Campaign collaboration', key: 'campaignCollaboration', format: 'boolean' },
      { label: 'Collaborators per campaign', key: 'maxCollaboratorsPerCampaign', format: 'unlimited' },
    ],
  },
]

function formatCellValue(value: unknown, format?: string): React.ReactNode {
  if (format === 'boolean') {
    return value ? (
      <CheckRoundedIcon sx={{ fontSize: 18, color: 'var(--text-brand)' }} />
    ) : (
      <CloseRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
    )
  }
  if (typeof value === 'number') {
    if (value === -1) return <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-brand)' }}>Unlimited</Typography>
    if (value === 0 && format === 'unlimited') return <CloseRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
    if (format === 'fee') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}%</Typography>
    if (format === 'goal') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>GH₵ {value.toLocaleString()}</Typography>
    return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}</Typography>
  }
  return String(value)
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SubscriptionPage() {
  const navigate = useNavigate()
  const { subscription, isLoading, refetch } = useMySubscription()
  // DB-backed plans (seeded from SUBSCRIPTION_PLANS so nothing flashes empty).
  const plans = usePlanMap()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [billingToggle, setBillingToggle] = useState<'monthly' | 'yearly'>('monthly')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // ── Paid checkout + coupon flow ────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [paymentsUnavailable, setPaymentsUnavailable] = useState(false)
  const { preview, loading: couponLoading, error: couponError, run: runCoupon, clear: clearCoupon } = useCouponPreview()

  const billingCycle: BillingCycle = billingToggle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY

  // Live-quote the coupon whenever the code, plan, or billing cycle changes.
  useEffect(() => {
    if (selectedTier && couponCode.trim()) {
      runCoupon({ code: couponCode, tier: selectedTier, billingCycle })
    } else {
      clearCoupon()
    }
  }, [couponCode, selectedTier, billingCycle, runCoupon, clearCoupon])

  function openCheckout(tier: SubscriptionTier) {
    setSelectedTier(tier)
    setCouponCode('')
    setCheckoutError(null)
    setPaymentsUnavailable(false)
    clearCoupon()
  }

  function closeCheckout() {
    if (checkoutLoading) return
    setSelectedTier(null)
    setCouponCode('')
    setCheckoutError(null)
    setPaymentsUnavailable(false)
    clearCoupon()
  }

  async function handleCheckout() {
    if (!selectedTier) return
    const tier = selectedTier
    setCheckoutLoading(true)
    setCheckoutError(null)
    setPaymentsUnavailable(false)
    try {
      const result = await createSubscriptionCheckout({
        tier,
        billingCycle,
        couponCode: couponCode.trim() || undefined,
      })
      if (result.activatedWithoutCharge) {
        // A coupon zeroed the price — the subscription is already active; show
        // the success state on the callback page (it polls the checkout status).
        refetch()
        navigate(`/subscription/callback?checkout=${encodeURIComponent(result.checkout.id)}`)
        return
      }
      if (result.authorizationUrl) {
        saveSubscriptionCheckoutHandoff({
          checkoutId: result.checkout.id,
          reference: result.reference,
          tier,
          billingCycle,
          finalAmount: result.preview.finalAmount,
          currency: result.preview.currency,
        })
        window.location.assign(result.authorizationUrl)
        return
      }
      setCheckoutError('We could not start checkout. Please try again.')
    } catch (err) {
      if (isPaymentsNotConfigured(err)) {
        setPaymentsUnavailable(true)
      } else {
        setCheckoutError(err instanceof Error ? err.message : 'We could not start checkout. Please try again.')
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleCancel() {
    setActionLoading(true)
    setActionError(null)
    try {
      await api.post('/subscriptions/cancel')
      setCancelDialogOpen(false)
      refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel subscription.')
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading || !subscription) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'center', py: 12 }}>
          <LinearProgress sx={{ borderRadius: 2, mb: 2 }} />
          <Typography sx={{ color: 'text.secondary' }}>Loading your subscription...</Typography>
        </Box>
      </Container>
    )
  }

  const currentSub = subscription
  const currentPlan = plans[currentSub.tier]
  const colors = TIER_COLORS[currentSub.tier]
  const daysLeft = Math.max(0, Math.ceil((new Date(currentSub.currentPeriodEnd).getTime() - Date.now()) / 86_400_000))

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Page header */}
      <Typography
        variant="h4"
        sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 900, mb: 1, animation: `${fadeInUp} 0.4s ease` }}
      >
        Subscription
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 5, animation: `${fadeInUp} 0.4s 0.05s ease both` }}>
        Manage your plan, billing, and features.
      </Typography>

      {/* ═══════════ ACTIVE PLAN CARD ═══════════ */}
      <Card
        elevation={0}
        sx={{
          mb: 7,
          borderRadius: SHAPE.card,
          overflow: 'hidden',
          boxShadow: 'var(--neu-raised)',
          animation: `${fadeInUp} 0.4s 0.1s ease both`,
        }}
      >
        {/* Gradient banner */}
        <Box
          sx={{
            bgcolor: colors.banner,
            px: { xs: 3, md: 4 },
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: SHAPE.sm,
                bgcolor: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RocketLaunchRoundedIcon sx={{ color: '#fff', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', fontFamily: '"Outfit", sans-serif', lineHeight: 1.2 }}>
                {currentPlan.name} Plan
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
                {currentPlan.description}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={currentSub.status === SubscriptionStatus.ACTIVE ? 'Active' : currentSub.status}
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              bgcolor: currentSub.status === SubscriptionStatus.ACTIVE ? 'rgba(255,255,255,0.25)' : 'rgba(255,100,100,0.35)',
              color: '#fff',
            }}
          />
        </Box>

        {/* Stats row */}
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2.5,
              mb: 3,
            }}
          >
            {[
              {
                icon: <ReceiptLongRoundedIcon sx={{ fontSize: 20, color: colors.accent }} />,
                label: 'Billing',
                value: currentSub.billingCycle === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly',
              },
              {
                icon: <CalendarTodayRoundedIcon sx={{ fontSize: 20, color: colors.accent }} />,
                label: 'Renews in',
                value: `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
              },
              {
                icon: <TrendingUpRoundedIcon sx={{ fontSize: 20, color: colors.accent }} />,
                label: 'Platform fee',
                value: `${currentPlan.platformFeePercent}%`,
              },
              {
                icon: <CampaignRoundedIcon sx={{ fontSize: 20, color: colors.accent }} />,
                label: 'Active campaigns',
                value: currentPlan.maxActiveCampaigns === -1 ? 'Unlimited' : String(currentPlan.maxActiveCampaigns),
              },
            ].map((stat) => (
              <Box
                key={stat.label}
                sx={{
                  p: 2,
                  borderRadius: SHAPE.sm,
                  bgcolor: colors.bg,
                  boxShadow: 'var(--neu-subtle)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  {stat.icon}
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {stat.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: '"Outfit", sans-serif' }}>
                  {stat.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Quick features */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {[
              currentPlan.featuredListing && 'Featured Listing',
              currentPlan.prioritySupport && 'Priority Support',
              currentPlan.advancedAnalytics && 'Analytics',
              currentPlan.customBranding && 'Custom Branding',
              currentPlan.escrowSupport && 'Escrow',
              currentPlan.liveStreaming && 'Live Streaming',
              currentPlan.campaignCollaboration && 'Collaboration',
            ]
              .filter(Boolean)
              .map((feat) => (
                <Chip
                  key={feat as string}
                  icon={<CheckRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  label={feat}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    bgcolor: 'rgba(46, 61, 47,0.06)',
                    color: 'var(--text-brand)',
                    '& .MuiChip-icon': { color: 'var(--text-brand)' },
                  }}
                />
              ))}
          </Box>

          {/* Period + Cancel */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, pt: 2, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
              Period: {new Date(currentSub.currentPeriodStart).toLocaleDateString()} &mdash; {new Date(currentSub.currentPeriodEnd).toLocaleDateString()}
            </Typography>
            {currentSub.tier !== SubscriptionTier.FREE && (
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={() => setCancelDialogOpen(true)}
                sx={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'none' }}
              >
                Cancel subscription
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* ═══════════ PLAN CARDS ═══════════ */}
      <Box sx={{ textAlign: 'center', mb: 4, animation: `${fadeInUp} 0.4s 0.15s ease both` }}>
        <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 1.5 }}>
          Choose Your Plan
        </Typography>

        {/* Billing toggle */}
        <Box sx={{ display: 'inline-flex', borderRadius: SHAPE.sm, border: '1px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {(['monthly', 'yearly'] as const).map((cycle) => (
            <Box
              key={cycle}
              component="button"
              onClick={() => setBillingToggle(cycle)}
              sx={{
                px: 3, py: 1,
                border: 'none',
                bgcolor: billingToggle === cycle ? '#1a1a1a' : 'transparent',
                color: billingToggle === cycle ? '#fff' : 'text.secondary',
                fontWeight: 700,
                fontSize: '0.82rem',
                fontFamily: '"Outfit", sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
              {cycle === 'yearly' && (
                <Box component="span" sx={{ ml: 1, color: billingToggle === 'yearly' ? '#2F6B46' : 'var(--text-brand)', fontSize: '0.72rem', fontWeight: 800 }}>
                  Save 17%
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2.5,
          mb: 8,
        }}
      >
        {TIER_ORDER.map((tier, idx) => {
          const plan = plans[tier]
          const isCurrent = tier === currentSub.tier
          const isPro = tier === SubscriptionTier.PRO
          const tc = TIER_COLORS[tier]
          const price = billingToggle === 'yearly' ? plan.priceYearly : plan.priceMonthly
          const canCheckout = !isCurrent && tier !== SubscriptionTier.FREE && tier !== SubscriptionTier.ENTERPRISE

          return (
            <Card
              key={tier}
              elevation={0}
              sx={{
                border: isCurrent ? `2px solid ${tc.accent}` : '1px solid rgba(0,0,0,0.08)',
                borderRadius: SHAPE.card,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                animation: `${fadeInUp} 0.4s ${0.2 + idx * 0.06}s ease both`,
                transition: 'border-color 0.2s ease',
                '&:hover': {
                  borderColor: isCurrent ? tc.accent : 'rgba(0,0,0,0.18)',
                },
              }}
            >
              {isPro && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -1,
                    left: 0,
                    right: 0,
                    height: 3,
                    bgcolor: tc.banner,
                  }}
                />
              )}
              {isCurrent && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                  }}
                >
                  <Chip
                    icon={<StarRoundedIcon sx={{ fontSize: '14px !important', color: '#C7A24A !important' }} />}
                    label="Current"
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: 'rgba(199, 162, 74,0.1)', color: 'var(--text-warning)' }}
                  />
                </Box>
              )}
              <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: '"Outfit", sans-serif', mb: 0.25 }}>
                  {plan.name}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', mb: 2.5, lineHeight: 1.4 }}>
                  {plan.description}
                </Typography>

                {/* Price */}
                <Box sx={{ mb: 2.5 }}>
                  {tier === SubscriptionTier.ENTERPRISE ? (
                    <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', fontFamily: '"Outfit", sans-serif' }}>Custom</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: '2rem', fontFamily: '"Outfit", sans-serif', lineHeight: 1 }}>
                        GH₵ {billingToggle === 'yearly' ? Math.round(price / 12) : price}
                      </Typography>
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                        /mo
                      </Typography>
                    </Box>
                  )}
                  {billingToggle === 'yearly' && tier !== SubscriptionTier.FREE && tier !== SubscriptionTier.ENTERPRISE && (
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
                      GH₵ {price}/year &middot; billed annually
                    </Typography>
                  )}
                </Box>

                {/* Key features */}
                <Box sx={{ flex: 1, mb: 2.5 }}>
                  {[
                    `${plan.platformFeePercent}% platform fee`,
                    plan.maxActiveCampaigns === -1 ? 'Unlimited campaigns' : `${plan.maxActiveCampaigns} active campaign${plan.maxActiveCampaigns !== 1 ? 's' : ''}`,
                    plan.maxCampaignGoal === -1 ? 'No goal limit' : `Up to GH₵ ${plan.maxCampaignGoal.toLocaleString()} goal`,
                    plan.featuredListing && 'Featured listing',
                    plan.prioritySupport && 'Priority support',
                    plan.advancedAnalytics && 'Advanced analytics',
                    plan.escrowSupport && 'Escrow & milestones',
                    plan.liveStreaming && 'Live streaming',
                    plan.campaignCollaboration && 'Campaign collaboration',
                  ]
                    .filter(Boolean)
                    .map((feat) => (
                      <Box key={feat as string} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <CheckRoundedIcon sx={{ fontSize: 15, color: tc.accent, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.3 }}>{feat}</Typography>
                      </Box>
                    ))}
                </Box>

                {isCurrent ? (
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      fontFamily: '"Outfit", sans-serif',
                      textTransform: 'none',
                      py: 1.2,
                      borderColor: tc.accent,
                      color: tc.accent,
                    }}
                  >
                    Current Plan
                  </Button>
                ) : tier === SubscriptionTier.ENTERPRISE ? (
                  <Button
                    variant="outlined"
                    fullWidth
                    component="a"
                    href="mailto:sales@ujimora.com?subject=Enterprise%20plan%20enquiry"
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      fontFamily: '"Outfit", sans-serif',
                      textTransform: 'none',
                      py: 1.2,
                      borderColor: tc.accent,
                      color: tc.accent,
                    }}
                  >
                    Contact sales
                  </Button>
                ) : tier === SubscriptionTier.FREE ? (
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      fontFamily: '"Outfit", sans-serif',
                      textTransform: 'none',
                      py: 1.2,
                    }}
                  >
                    Free plan
                  </Button>
                ) : (
                  <Button
                    variant={isPro ? 'contained' : 'outlined'}
                    fullWidth
                    onClick={() => openCheckout(tier)}
                    disabled={!canCheckout}
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      fontFamily: '"Outfit", sans-serif',
                      textTransform: 'none',
                      py: 1.2,
                      ...(isPro
                        ? { bgcolor: tc.banner, color: '#fff', '&:hover': { bgcolor: '#1C261D' } }
                        : { borderColor: tc.accent, color: tc.accent }),
                    }}
                  >
                    Choose {plan.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </Box>

      {/* ═══════════ FEATURE COMPARISON TABLE ═══════════ */}
      <Box sx={{ mb: 6, animation: `${fadeInUp} 0.4s 0.3s ease both` }}>
        <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 4, textAlign: 'center' }}>
          Feature Comparison
        </Typography>

        <Box
          sx={{
            borderRadius: SHAPE.card,
            boxShadow: 'var(--neu-raised)',
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1.6fr repeat(4, 1fr)', md: '2fr repeat(4, 1fr)' },
              bgcolor: 'background.paper',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <Box sx={{ px: 3, py: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'text.secondary' }}>Feature</Typography>
            </Box>
            {TIER_ORDER.map((tier) => {
              const plan = plans[tier]
              const isCurrent = tier === currentSub.tier
              const tc = TIER_COLORS[tier]
              return (
                <Box
                  key={tier}
                  sx={{
                    px: 1.5,
                    py: 2,
                    textAlign: 'center',
                    position: 'relative',
                    ...(isCurrent && {
                      bgcolor: tc.bg,
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        bgcolor: tc.banner,
                      },
                    }),
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', fontFamily: '"Outfit", sans-serif' }}>
                    {plan.name}
                  </Typography>
                  {isCurrent && (
                    <StarRoundedIcon sx={{ fontSize: 12, color: '#C7A24A', ml: 0.5, verticalAlign: 'text-top' }} />
                  )}
                </Box>
              )
            })}
          </Box>

          {/* Sections */}
          {FEATURE_SECTIONS.map((section) => (
            <Box key={section.title}>
              {/* Section header */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1.6fr repeat(4, 1fr)', md: '2fr repeat(4, 1fr)' },
                  bgcolor: 'rgba(0,0,0,0.02)',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <Box sx={{ px: 3, py: 1.25, gridColumn: 'span 5' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                    {section.title}
                  </Typography>
                </Box>
              </Box>

              {/* Feature rows */}
              {section.rows.map((row, ri) => (
                <Box
                  key={row.key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1.6fr repeat(4, 1fr)', md: '2fr repeat(4, 1fr)' },
                    borderBottom: ri < section.rows.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.01)' },
                  }}
                >
                  <Box sx={{ px: 3, py: 1.75, display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{row.label}</Typography>
                  </Box>
                  {TIER_ORDER.map((tier) => {
                    const plan = plans[tier]
                    const isCurrent = tier === currentSub.tier
                    const tc = TIER_COLORS[tier]
                    return (
                      <Box
                        key={tier}
                        sx={{
                          px: 1.5,
                          py: 1.75,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ...(isCurrent && { bgcolor: `${tc.bg}` }),
                        }}
                      >
                        {formatCellValue(plan[row.key], row.format)}
                      </Box>
                    )
                  })}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Action error */}
      {actionError && (
        <Box sx={{ mb: 4 }}>
          <Typography color="error" sx={{ fontSize: '0.88rem', fontWeight: 600 }}>
            {actionError}
          </Typography>
        </Box>
      )}

      {/* ═══════════ UPGRADE CTA ═══════════ */}
      {currentSub.tier === SubscriptionTier.FREE && (
        <Card
          elevation={0}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: SHAPE.card,
            bgcolor: 'rgba(46, 61, 47,0.04)',
            border: '1.5px dashed rgba(46, 61, 47,0.25)',
            animation: `${fadeInUp} 0.4s 0.35s ease both`,
          }}
        >
          <Typography sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
            Ready to grow your impact?
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3, maxWidth: 500, mx: 'auto' }}>
            Upgrade to a paid plan for lower platform fees, more campaigns, and premium features.
            Have a coupon? Apply it at checkout.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => openCheckout(SubscriptionTier.PRO)}
            startIcon={<RocketLaunchRoundedIcon />}
            sx={{
              bgcolor: '#2E3D2F',
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              px: 5,
              borderRadius: SHAPE.sm,
              textTransform: 'none',
              '&:hover': { bgcolor: '#1C261D' },
            }}
          >
            Upgrade to Pro
          </Button>
        </Card>
      )}

      {/* ═══════════ CHECKOUT DIALOG ═══════════ */}
      <Dialog
        open={selectedTier !== null}
        onClose={closeCheckout}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: SHAPE.card } }}
      >
        {selectedTier && (() => {
          const plan = plans[selectedTier]
          const basePrice = billingToggle === 'yearly' ? plan.priceYearly : plan.priceMonthly
          const validCoupon = preview && preview.valid ? preview : null
          const currency = validCoupon?.currency ?? 'GHS'
          const finalAmount = validCoupon ? validCoupon.finalAmount : basePrice
          return (
            <>
              <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800 }}>
                Upgrade to {plan.name}
              </DialogTitle>
              <DialogContent>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
                  Billed {billingToggle === 'yearly' ? 'yearly' : 'monthly'}. You can cancel anytime.
                </Typography>

                <TextField
                  fullWidth
                  label="Coupon code (optional)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={checkoutLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocalOfferRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                    endAdornment: couponLoading ? (
                      <InputAdornment position="end">
                        <CircularProgress size={16} />
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={{ mb: 1.5 }}
                />

                {/* Coupon feedback */}
                {couponError && (
                  <Typography sx={{ fontSize: '0.78rem', color: 'error.main', mb: 1 }}>{couponError}</Typography>
                )}
                {preview && !preview.valid && preview.reason && (
                  <Typography sx={{ fontSize: '0.78rem', color: 'error.main', mb: 1 }}>{preview.reason}</Typography>
                )}
                {validCoupon && validCoupon.discountAmount > 0 && (
                  <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-success)', fontWeight: 600, mb: 1 }}>
                    Coupon applied — you save {formatCurrency(validCoupon.discountAmount, currency)}.
                  </Typography>
                )}

                {/* Price summary */}
                <Box sx={{ mt: 1, p: 2, borderRadius: SHAPE.sm, bgcolor: 'rgba(46, 61, 47,0.05)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: validCoupon ? 0.5 : 0 }}>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      {plan.name} · {billingToggle === 'yearly' ? 'Yearly' : 'Monthly'}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.85rem',
                        ...(validCoupon && { textDecoration: 'line-through', color: 'text.disabled' }),
                      }}
                    >
                      {formatCurrency(basePrice, currency)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>Total due today</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: '"Outfit", sans-serif', color: 'primary.dark' }}>
                      {formatCurrency(finalAmount, currency)}
                    </Typography>
                  </Box>
                </Box>

                {paymentsUnavailable && (
                  <Alert severity="info" sx={{ mt: 2, borderRadius: SHAPE.sm }}>
                    Online payments aren't configured yet. Please check back soon — you haven't been charged.
                  </Alert>
                )}
                {checkoutError && (
                  <Alert severity="error" sx={{ mt: 2, borderRadius: SHAPE.sm }}>{checkoutError}</Alert>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={closeCheckout} disabled={checkoutLoading} sx={{ fontWeight: 600, textTransform: 'none' }}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  startIcon={checkoutLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                  sx={{ bgcolor: '#2E3D2F', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#1C261D' } }}
                >
                  {checkoutLoading ? 'Starting…' : finalAmount === 0 ? 'Activate plan' : 'Continue to payment'}
                </Button>
              </DialogActions>
            </>
          )
        })()}
      </Dialog>

      {/* ═══════════ CANCEL DIALOG ═══════════ */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} PaperProps={{ sx: { borderRadius: SHAPE.card } }}>
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          Cancel Subscription?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            Your subscription will remain active until the end of your current billing period
            ({new Date(currentSub.currentPeriodEnd).toLocaleDateString()}). After that, you'll be moved to the
            Free plan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={actionLoading} sx={{ fontWeight: 600, textTransform: 'none' }}>
            Keep Subscription
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleCancel}
            disabled={actionLoading}
            sx={{ fontWeight: 600, textTransform: 'none' }}
          >
            {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default SubscriptionPage
