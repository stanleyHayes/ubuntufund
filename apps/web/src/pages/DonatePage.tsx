import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Skeleton from '@mui/material/Skeleton'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import InputAdornment from '@mui/material/InputAdornment'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { keyframes } from '@emotion/react'
import {
  ProgressBar,
  PaymentMethods,
  ErrorState,
  ItemNotFound,
  BrandLogo,
  formatCurrency,
  SHAPE,
  LoadingDots,
} from '@ubuntu-fund/ui'
import { CampaignStatus } from '@ubuntu-fund/types'
import {
  getCampaignBySlug,
  createDonationIntent,
  isPaymentsNotConfigured,
  campaignPublicPath,
  type CampaignPublicView,
} from '@/lib/fundraising'
import { getCryptoAssets } from '@/lib/crypto'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { useAuth } from '@/context/AuthContext'
import { useCouponPreview } from '@/hooks/useCouponPreview'
import { CouponSurface } from '@ubuntu-fund/types'
import { CryptoDonatePanel } from '@/components/donate/CryptoDonatePanel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const PRESET_AMOUNTS = [20, 50, 100, 200] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Handoff store — lets the Paystack return page (`/donate/callback`) recover the
// intent id (to poll) and the campaign slug (to link back) from the reference
// Paystack echoes on redirect. localStorage survives the full-page round-trip.
const HANDOFF_KEY = 'uf_pending_donations'

interface PendingDonation {
  intentId: string
  reference?: string
  slug: string
  title: string
  amount: number
  currency: string
}

/** Persist the pending-donation handoff keyed by its Paystack reference. */
function rememberPendingDonation(entry: PendingDonation): void {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY)
    const store: Record<string, PendingDonation> = raw ? JSON.parse(raw) : {}
    if (entry.reference) store[entry.reference] = entry
    // Keep a "latest" fallback for the case where no reference reaches the callback.
    store.__last = entry
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(store))
  } catch {
    // Storage may be unavailable (private mode) — the callback still works by
    // parsing the intent id out of the reference, so this is best-effort only.
  }
}

function looksLikeNotFound(message: string): boolean {
  return /not\s*found|404|no\s*such|does not exist/i.test(message)
}

/** Parse a positive money amount from a free-text field; returns NaN when invalid. */
function parseAmount(raw: string): number {
  if (!raw.trim()) return NaN
  const n = Number(raw)
  return Number.isFinite(n) ? n : NaN
}

// ---------------------------------------------------------------------------
// DonatePage — guest checkout (Paystack card + mobile money)
// Route: /c/:slug/donate  (optional ?amount= preset)
// ---------------------------------------------------------------------------

export function DonatePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [campaign, setCampaign] = useState<CampaignPublicView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Form state
  const [amount, setAmount] = useState('')
  const [tip, setTip] = useState('')
  // A fee-waiver code reduces the platform's cut, never the gift. It needs a
  // signed-in donor because the coupon's per-user limit has nobody to count
  // against otherwise, so the field is hidden from guests rather than shown
  // and then refused.
  const { user } = useAuth()
  const [couponCode, setCouponCode] = useState('')
  const {
    preview: couponPreview,
    loading: couponLoading,
    error: couponError,
    run: runCoupon,
    clear: clearCoupon,
  } = useCouponPreview()
  const [donorEmail, setDonorEmail] = useState('')
  const [donorName, setDonorName] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  // Payment rail: fiat (Paystack) by default; crypto shown only when enabled.
  const [cryptoEnabled, setCryptoEnabled] = useState(false)
  const [payMode, setPayMode] = useState<'fiat' | 'crypto'>('fiat')

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [paymentsDisabled, setPaymentsDisabled] = useState(false)
  const [touchedEmail, setTouchedEmail] = useState(false)

  useSeo({
    title: campaign ? `Donate to ${campaign.title} | Ujimora` : 'Donate | Ujimora',
    description:
      'Choose an amount in cedis and give securely by mobile money or card. No account needed, and your receipt arrives by email.',
    // A checkout form has nothing to rank for on its own, and it splits signals
    // with the campaign page that links to it — so it points there instead.
    path: `/c/${encodeURIComponent(slug ?? '')}/donate`,
    canonicalUrl: `${SITE_ORIGIN}/c/${encodeURIComponent(slug ?? '')}`,
    robots: 'noindex, follow',
  })

  // Seed the amount from ?amount= (once, if valid)
  useEffect(() => {
    const preset = searchParams.get('amount')
    if (preset) {
      const n = parseAmount(preset)
      if (Number.isFinite(n) && n > 0) setAmount(String(n))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!slug) return
    let active = true
    setIsLoading(true)
    setLoadError(null)
    setNotFound(false)

    getCampaignBySlug(slug)
      .then((data) => {
        if (active) setCampaign(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        const msg = err instanceof Error ? err.message : 'Failed to load campaign'
        if (looksLikeNotFound(msg)) setNotFound(true)
        else setLoadError(msg)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [slug])

  // Crypto rail availability (server-driven; the toggle is hidden when off).
  useEffect(() => {
    let active = true
    getCryptoAssets()
      .then((r) => {
        if (active) setCryptoEnabled(r.enabled && r.assets.length > 0)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const amountValue = parseAmount(amount)
  const tipValue = tip.trim() ? parseAmount(tip) : 0
  const emailValid = EMAIL_RE.test(donorEmail.trim())
  const amountValid = Number.isFinite(amountValue) && amountValue > 0
  const tipValid = tip.trim() === '' || (Number.isFinite(tipValue) && tipValue >= 0)
  const isActive = campaign?.status === CampaignStatus.ACTIVE

  const totalCharge = useMemo(
    () => (amountValid ? amountValue : 0) + (tipValid && Number.isFinite(tipValue) ? tipValue : 0),
    [amountValid, amountValue, tipValid, tipValue],
  )

  // Quote the code whenever it or the amount changes: the waiver is a share of
  // the platform fee, which is itself a share of the amount, so the saving
  // moves with the gift.
  useEffect(() => {
    if (user && campaign && couponCode.trim() && amountValid) {
      runCoupon({
        code: couponCode,
        surface: CouponSurface.DONATION,
        campaignId: campaign.id,
        amount: amountValue,
        currency: campaign.currency,
      })
    } else {
      clearCoupon()
    }
  }, [user, campaign, couponCode, amountValid, amountValue, runCoupon, clearCoupon])

  const validCoupon = couponPreview?.valid ? couponPreview : null

  const canSubmit =
    !submitting &&
    !paymentsDisabled &&
    !!campaign &&
    isActive &&
    amountValid &&
    emailValid &&
    tipValid &&
    // An invalid code aborts the donation server-side, so block it here rather
    // than letting the donor press Give and be rejected.
    !(couponCode.trim() && couponPreview && !couponPreview.valid)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!campaign || !slug || !canSubmit) return

    setSubmitting(true)
    setSubmitError('')
    setPaymentsDisabled(false)

    try {
      const result = await createDonationIntent({
        campaignId: campaign.id,
        liveSessionId: searchParams.get('liveSessionId') || undefined,
        amount: amountValue,
        tip: tipValid && Number.isFinite(tipValue) && tipValue > 0 ? tipValue : undefined,
        couponCode: user && couponCode.trim() ? couponCode.trim() : undefined,
        provider: 'paystack',
        donorEmail: donorEmail.trim(),
        donorName: donorName.trim() || undefined,
        message: message.trim() || undefined,
        isAnonymous,
      })

      if (!result.authorization_url) {
        // Paystack should always return a hosted-checkout URL. If it didn't,
        // we cannot proceed — surface it rather than silently "succeeding".
        setSubmitError('We could not start the secure checkout. Please try again in a moment.')
        setSubmitting(false)
        return
      }

      // Persist the reference → intent handoff so the callback page can poll
      // the right intent (the webhook, not this redirect, is the source of truth).
      rememberPendingDonation({
        intentId: result.intent.id,
        reference: result.reference,
        slug,
        title: campaign.title,
        amount: amountValue,
        currency: 'GHS',
      })

      // Hand the browser to Paystack's hosted checkout. NEVER treat this as success.
      window.location.href = result.authorization_url
    } catch (err) {
      if (isPaymentsNotConfigured(err)) {
        setPaymentsDisabled(true)
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  // --- Loading / error / not-found gates ------------------------------------

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
        <Skeleton width={140} height={20} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={92} sx={{ borderRadius: SHAPE.card, mb: 4 }} />
        <Skeleton width="45%" height={28} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          {PRESET_AMOUNTS.map((p) => (
            <Skeleton key={p} variant="rounded" width={72} height={44} sx={{ borderRadius: SHAPE.sm }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: SHAPE.sm, mb: 2 }} />
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: SHAPE.sm, mb: 2 }} />
        <Skeleton variant="rounded" height={48} sx={{ borderRadius: SHAPE.sm }} />
      </Container>
    )
  }

  if (notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Campaign"
          message="This fundraiser link may have expired, been removed, or been mistyped."
          onBack={() => navigate('/')}
          backLabel="Explore campaigns"
        />
      </Container>
    )
  }

  if (loadError) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ErrorState
          title="Couldn't load this campaign"
          message={loadError}
          onRetry={() => window.location.reload()}
        />
      </Container>
    )
  }

  if (!campaign) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound itemType="Campaign" onBack={() => navigate('/')} backLabel="Explore campaigns" />
      </Container>
    )
  }

  const backToCampaign = campaignPublicPath(slug ?? campaign.id)

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      {/* Back link */}
      <Link
        component={RouterLink}
        to={backToCampaign}
        underline="none"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 3,
          color: 'text.secondary',
          fontWeight: 600,
          fontSize: '0.875rem',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
        Back to campaign
      </Link>

      {/* Campaign context header */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          mb: 4,
          borderRadius: SHAPE.card,
          boxShadow: 'var(--neu-raised)',
          bgcolor: 'background.paper',
          animation: `${fadeInUp} 0.4s ease both`,
        }}
      >
        {(campaign.socialPreview?.imageUrl ?? campaign.imageUrls?.[0]) && (
          <Box
            component="img"
            src={campaign.socialPreview?.imageUrl ?? campaign.imageUrls?.[0]}
            alt=""
            aria-hidden
            sx={{
              width: 64,
              height: 64,
              flexShrink: 0,
              objectFit: 'cover',
              borderRadius: SHAPE.sm,
            }}
          />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, lineHeight: 1.3, mb: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {campaign.title}
          </Typography>
          <ProgressBar
            current={campaign.raisedAmount}
            goal={campaign.goalAmount}
            currency="GHS"
            showPercentage={false}
          />
        </Box>
      </Box>

      <Typography
        variant="h4"
        component="h1"
        sx={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', mb: 0.5 }}
      >
        Make a donation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Give securely by card or mobile money. Every cedi goes further.
      </Typography>

      {!isActive && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: SHAPE.sm }}>
          This campaign isn't accepting donations right now.
        </Alert>
      )}

      {paymentsDisabled && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: SHAPE.sm }}
          action={
            <Button component={RouterLink} to={backToCampaign} size="small" color="inherit">
              Back to campaign
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 700 }}>Payments aren't enabled yet</AlertTitle>
          Card & mobile money payments aren't enabled yet — please check back soon.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        {/* Amount */}
        <Typography
          component="label"
          htmlFor="donation-amount"
          sx={{
            display: 'block',
            fontWeight: 700,
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'text.secondary',
            mb: 1.5,
          }}
        >
          Choose an amount
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {PRESET_AMOUNTS.map((preset) => {
            const selected = amountValid && amountValue === preset
            return (
              <Button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                aria-pressed={selected}
                variant={selected ? 'contained' : 'text'}
                color={selected ? 'primary' : 'inherit'}
                sx={{
                  minWidth: 76,
                  fontWeight: 700,
                  boxShadow: selected ? undefined : 'var(--neu-subtle)',
                }}
              >
                {formatCurrency(preset, 'GHS')}
              </Button>
            )
          })}
        </Box>

        <TextField
          id="donation-amount"
          label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          fullWidth
          required
          inputMode="decimal"
          error={amount.trim() !== '' && !amountValid}
          helperText={amount.trim() !== '' && !amountValid ? 'Enter an amount greater than zero' : ' '}
          InputProps={{
            startAdornment: <InputAdornment position="start">GH₵</InputAdornment>,
          }}
          sx={{ mb: 1.5 }}
        />

        {/* Optional tip */}
        <TextField
          id="donation-tip"
          label="Add a tip to support the platform (optional)"
          value={tip}
          onChange={(e) => setTip(e.target.value.replace(/[^\d.]/g, ''))}
          fullWidth
          inputMode="decimal"
          error={!tipValid}
          helperText={!tipValid ? 'Enter a valid tip amount' : ' '}
          InputProps={{
            startAdornment: <InputAdornment position="start">GH₵</InputAdornment>,
          }}
          sx={{ mb: 3 }}
        />

        {/* Fee-waiver code. Signed-in donors only: the coupon's per-user limit
            has nobody to count against for a guest. */}
        {user && (
          <>
            <TextField
              id="donation-coupon"
              label="Fee waiver code (optional)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              fullWidth
              disabled={submitting}
              helperText={
                couponError ||
                (couponPreview && !couponPreview.valid ? couponPreview.reason : undefined) ||
                (validCoupon && validCoupon.discountAmount > 0
                  ? `Applied — ${formatCurrency(validCoupon.discountAmount, campaign?.currency ?? 'GHS')} more reaches this campaign.`
                  : 'Waives part of our platform fee. You still give the full amount above.')
              }
              error={Boolean(couponError) || Boolean(couponPreview && !couponPreview.valid)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocalOfferRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: couponLoading ? (
                  <InputAdornment position="end">
                    <Skeleton width={36} height={24} aria-label="Checking code" />
                  </InputAdornment>
                ) : undefined,
              }}
              sx={{ mb: 3 }}
            />
          </>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Donor details */}
        <TextField
          id="donor-email"
          label="Email for your receipt"
          type="email"
          value={donorEmail}
          onChange={(e) => setDonorEmail(e.target.value)}
          onBlur={() => setTouchedEmail(true)}
          fullWidth
          required
          autoComplete="email"
          error={touchedEmail && donorEmail.trim() !== '' && !emailValid}
          helperText={
            touchedEmail && donorEmail.trim() !== '' && !emailValid
              ? 'Enter a valid email address'
              : 'We’ll send your donation receipt here.'
          }
          sx={{ mb: 2 }}
        />

        <TextField
          id="donor-name"
          label="Your name (optional)"
          value={donorName}
          onChange={(e) => setDonorName(e.target.value)}
          fullWidth
          autoComplete="name"
          disabled={isAnonymous}
          sx={{ mb: 2 }}
        />

        <TextField
          id="donor-message"
          label="Leave a message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mb: 1 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              sx={{ '&:focus-visible': { outline: '2px solid #C7A24A' } }}
            />
          }
          label="Give anonymously (hide my name publicly)"
          sx={{ mb: 3, display: 'block' }}
        />

        {/* Payment rail: fiat (Paystack) or crypto (shown only when enabled) */}
        {cryptoEnabled && (
          <ToggleButtonGroup
            value={payMode}
            exclusive
            onChange={(_, v) => {
              if (v) setPayMode(v)
            }}
            fullWidth
            aria-label="Contribution payment method"
            sx={{ mb: 2.5, p: .5, gap: .5, bgcolor: 'action.hover', borderRadius: 3, "& .MuiToggleButtonGroup-grouped": { border: 0, borderRadius: '16px !important', minHeight: 52 }, "& .Mui-selected": { boxShadow: 'var(--neu-subtle)' } }}
          >
            <ToggleButton value="fiat" sx={{ textTransform: 'none', fontWeight: 700, py: 1 }}>
              Card / Mobile Money
            </ToggleButton>
            <ToggleButton value="crypto" sx={{ textTransform: 'none', fontWeight: 700, py: 1 }}>
              Crypto
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {payMode === 'crypto' ? (
          <CryptoDonatePanel
            campaignId={campaign.id}
            amount={amountValid ? amountValue : 0}
            amountValid={amountValid}
            donorEmail={donorEmail.trim()}
            emailValid={emailValid}
            donorName={donorName.trim() || undefined}
            message={message.trim() || undefined}
            isAnonymous={isAnonymous}
            campaignPath={backToCampaign}
          />
        ) : (
          <>
            {/* Accepted payment methods (routed securely through Paystack) */}
            <Box
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: SHAPE.card,
                bgcolor: 'action.hover',
              }}
            >
              <PaymentMethods
                compact
                title="You can pay with"
                categories={['mobile_money', 'card']}
              />
            </Box>

            {submitError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: SHAPE.sm }}>
                {submitError}
              </Alert>
            )}

            {/* Submit */}
            <Button
              type="submit"
              fullWidth
              size="large"
              variant="contained"
              color="secondary"
              disabled={!canSubmit}
              startIcon={submitting ? <LoadingDots size={6} /> : <LockRoundedIcon />}
              sx={{ py: 1.5, fontSize: '1.05rem', fontWeight: 800 }}
            >
              {submitting
                ? 'Starting secure checkout…'
                : totalCharge > 0
                  ? `Donate ${formatCurrency(totalCharge, 'GHS')}`
                  : 'Continue to payment'}
            </Button>

            <Box
              sx={{
                mt: 2.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.25,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                <LockRoundedIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  You'll choose card or mobile money on the next, secure step.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Powered by
                </Typography>
                <BrandLogo size={18} />
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Container>
  )
}
