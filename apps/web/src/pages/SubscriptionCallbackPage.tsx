import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import { keyframes } from '@emotion/react'
import { ItemNotFound, BrandLogo, formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { SUBSCRIPTION_PLANS } from '@ubuntu-fund/types'
import {
  getSubscriptionCheckoutStatus,
  readSubscriptionHandoff,
  subscriptionPath,
  dashboardPath,
  SubscriptionCheckoutStatus,
  type SubscriptionCheckout,
} from '@/lib/subscriptions'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const popIn = keyframes`
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
`

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 15 // ~30s

type Phase = 'resolving' | 'pending' | 'succeeded' | 'failed' | 'expired' | 'timeout' | 'missing'

// ---------------------------------------------------------------------------
// Celebratory check mark
// ---------------------------------------------------------------------------

function SuccessMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 96,
        height: 96,
        mx: 'auto',
        mb: 3,
        borderRadius: '50%',
        bgcolor: 'rgba(47, 107, 70, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: `${popIn} 0.5s ease both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke="#2F6B46"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SubscriptionCallbackPage — Paystack return / checkout status confirmation
// Route: /subscription/callback
// ---------------------------------------------------------------------------

export function SubscriptionCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const explicitId = searchParams.get('checkout') ?? searchParams.get('id')

  // Recover the pending checkout once (the reference is fixed for this visit);
  // a lazy useState initializer keeps it stable and render-safe.
  const [handoff] = useState(() => readSubscriptionHandoff(reference))
  const checkoutId = explicitId ?? handoff?.checkoutId ?? null

  const [phase, setPhase] = useState<Phase>(checkoutId ? 'resolving' : 'missing')
  const [view, setView] = useState<SubscriptionCheckout | null>(null)
  const [pollNonce, setPollNonce] = useState(0)

  useEffect(() => {
    // The missing case is already the initial phase; nothing to poll.
    if (!checkoutId) return

    let active = true
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      attempts += 1
      try {
        const status = await getSubscriptionCheckoutStatus(checkoutId as string)
        if (!active) return
        setView(status)

        if (status.status === SubscriptionCheckoutStatus.SUCCEEDED) {
          setPhase('succeeded')
          return
        }
        if (status.status === SubscriptionCheckoutStatus.FAILED) {
          setPhase('failed')
          return
        }
        if (status.status === SubscriptionCheckoutStatus.EXPIRED) {
          setPhase('expired')
          return
        }
        // PENDING — keep confirming.
        setPhase('pending')
      } catch {
        // Transient error — fall through to retry until we run out of attempts.
        if (!active) return
        setPhase('pending')
      }

      if (attempts >= MAX_ATTEMPTS) {
        if (active) setPhase('timeout')
        return
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
    // pollNonce lets "Keep checking" restart the loop after a timeout.
  }, [checkoutId, pollNonce])

  const tier = view?.tier ?? handoff?.tier
  const planName = tier ? SUBSCRIPTION_PLANS[tier]?.name : undefined
  const chargedAmount = view?.finalAmount ?? handoff?.finalAmount
  const currency = view?.currency ?? handoff?.currency ?? 'GHS'
  const activatedWithoutCharge = chargedAmount === 0

  // --- Missing reference ----------------------------------------------------

  if (phase === 'missing') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Checkout"
          message="We couldn't find a checkout to confirm. If your payment went through, your subscription is activated once payment is confirmed — check your subscription page."
          onBack={() => navigate(subscriptionPath())}
          backLabel="Go to subscription"
        />
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 8 }, textAlign: 'center' }}>
      <Box
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: SHAPE.card,
          boxShadow: 'var(--neu-raised)',
          bgcolor: 'background.paper',
          animation: `${fadeInUp} 0.45s ease both`,
        }}
      >
        {/* ---- Pending / resolving ---- */}
        {(phase === 'resolving' || phase === 'pending') && (
          <>
            <CircularProgress sx={{ mb: 3, color: 'secondary.main' }} />
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
              Confirming your subscription…
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto' }}>
              Hang tight — we're waiting for your bank or mobile money provider to confirm.
              This usually takes just a few seconds.
            </Typography>
          </>
        )}

        {/* ---- Succeeded ---- */}
        {phase === 'succeeded' && (
          <>
            <SuccessMark />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 900, mb: 1 }}>
              You're all set!
            </Typography>
            {planName && (
              <Typography variant="h6" color="secondary.dark" sx={{ fontWeight: 800, mb: 1 }}>
                Your {planName} plan is now active
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 1 }}>
              {activatedWithoutCharge
                ? 'Your coupon covered the full price — no payment was needed.'
                : chargedAmount != null
                  ? `Your ${formatCurrency(chargedAmount, currency)} payment is confirmed.`
                  : 'Your payment is confirmed.'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 4 }}>
              A receipt is on its way to your email.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
              <Button
                component={RouterLink}
                to={dashboardPath()}
                variant="contained"
                color="secondary"
                sx={{ fontWeight: 800 }}
              >
                Go to dashboard
              </Button>
              <Button component={RouterLink} to={subscriptionPath()} variant="text">
                View subscription
              </Button>
            </Box>
          </>
        )}

        {/* ---- Failed / expired ---- */}
        {(phase === 'failed' || phase === 'expired') && (
          <>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
              {phase === 'expired' ? 'This checkout expired' : 'Payment didn’t go through'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 4 }}>
              {phase === 'expired'
                ? "Your checkout session timed out before payment completed. You haven't been charged — you can try again."
                : "Your payment couldn't be completed and you haven't been charged. This is usually temporary — please try again."}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
              <Button
                component={RouterLink}
                to={subscriptionPath()}
                variant="contained"
                color="secondary"
                startIcon={<ReplayRoundedIcon />}
                sx={{ fontWeight: 800 }}
              >
                Try again
              </Button>
              <Button component={RouterLink} to={dashboardPath()} variant="text">
                Back to dashboard
              </Button>
            </Box>
          </>
        )}

        {/* ---- Timeout (still pending after polling) ---- */}
        {phase === 'timeout' && (
          <>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
              Still confirming your subscription
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 4 }}>
              This is taking a little longer than usual. Your payment is verified securely in the
              background, so if it went through your plan activates shortly — no need to pay again.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<ReplayRoundedIcon />}
                onClick={() => {
                  setPhase('resolving')
                  setPollNonce((n) => n + 1)
                }}
                sx={{ fontWeight: 800 }}
              >
                Keep checking
              </Button>
              <Button component={RouterLink} to={subscriptionPath()} variant="text">
                View subscription
              </Button>
            </Box>
          </>
        )}

        {/* Trust footer */}
        <Box
          sx={{
            mt: 5,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Secured by
          </Typography>
          <BrandLogo size={18} />
        </Box>
      </Box>
    </Container>
  )
}
