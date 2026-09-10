import Skeleton from '@mui/material/Skeleton'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import { keyframes } from '@emotion/react'
import { ItemNotFound, BrandLogo, formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { DonationCelebration } from '@/components/donate/DonationCelebration'
import {
  getDonationIntentStatus,
  verifyDonationIntent,
  campaignPublicPath,
  donatePath,
  type DonationIntentPublicView,
} from '@/lib/fundraising'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Handoff store (written by DonatePage) — recover the intent id + campaign slug
// from the Paystack reference echoed back on the return redirect.
// ---------------------------------------------------------------------------

const HANDOFF_KEY = 'uf_pending_donations'

interface PendingDonation {
  intentId: string
  reference?: string
  slug: string
  title: string
  amount: number
  currency: string
}

function readHandoff(reference: string | null): PendingDonation | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    const store: Record<string, PendingDonation> = JSON.parse(raw)
    if (reference) return store[reference] ?? null
    return store.__last ?? null
  } catch {
    return null
  }
}

/**
 * Our Paystack references are minted server-side as `uf-<intentId>-<8hex>`
 * (see PaystackGateway). Recover the intent id when the handoff store is empty
 * (e.g. the donor returned in a different browser/tab).
 */
function intentIdFromReference(reference: string | null): string | null {
  if (!reference) return null
  const m = /^uf-(.+)-[0-9a-f]{8}$/i.exec(reference)
  return m ? m[1] : null
}

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 15 // ~30s

type Phase = 'resolving' | 'pending' | 'succeeded' | 'failed' | 'expired' | 'timeout' | 'missing'

// ---------------------------------------------------------------------------
// DonateCallbackPage — Paystack return / status confirmation
// Route: /donate/callback
// ---------------------------------------------------------------------------

export function DonateCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const explicitId = searchParams.get('intent') ?? searchParams.get('id')

  // Recover the donor's pending-donation handoff once per reference. A ref would
  // read stale during render (and trips the React Compiler ref rule); useMemo
  // keeps it a plain, render-safe derivation of the URL reference.
  const handoff = useMemo(() => readHandoff(reference), [reference])
  const intentId =
    intentIdFromReference(reference) ?? explicitId ?? handoff?.intentId
  const paymentReference = reference ?? handoff?.reference

  const [phase, setPhase] = useState<Phase>(intentId ? 'resolving' : 'missing')
  const [view, setView] = useState<DonationIntentPublicView | null>(null)
  const [snackOpen, setSnackOpen] = useState(false)
  const [pollNonce, setPollNonce] = useState(0)

  useEffect(() => {
    if (!intentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional phase reset when the id is lost on a re-run
      setPhase('missing')
      return
    }

    let active = true
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      attempts += 1
      try {
        // Retry provider verification every third poll; intervening polls read
        // our settled status. Neither redirect parameters nor receipts prove it.
        let status: DonationIntentPublicView
        if (paymentReference && attempts % 3 === 1) {
          try {
            status = await verifyDonationIntent(intentId as string, paymentReference)
          } catch {
            status = await getDonationIntentStatus(intentId as string)
          }
        } else {
          status = await getDonationIntentStatus(intentId as string)
        }
        if (!active) return
        setView(status)

        if (status.status === 'SUCCEEDED') {
          setPhase('succeeded')
          return
        }
        if (status.status === 'FAILED') {
          setPhase('failed')
          return
        }
        if (status.status === 'EXPIRED') {
          setPhase('expired')
          return
        }
        // CREATED / PENDING — keep confirming.
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

    setPhase('resolving')
    poll()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
    // pollNonce lets "Keep checking" restart the loop after a timeout.
  }, [intentId, paymentReference, pollNonce])

  const campaignSlug = handoff?.slug
  const campaignPath = campaignSlug
    ? campaignPublicPath(campaignSlug)
    : view
      ? `/campaigns/${view.campaignId}`
      : '/'

  const shareUrl = campaignSlug
    ? `${window.location.origin}${campaignPublicPath(campaignSlug)}`
    : `${window.location.origin}${campaignPath}`

  const handleShare = useCallback(async () => {
    const shareTitle = handoff?.title ? `Support: ${handoff.title}` : 'Support this campaign'
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl })
        return
      } catch {
        // User cancelled or share failed — fall back to copy below.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setSnackOpen(true)
    } catch {
      setSnackOpen(true)
    }
  }, [handoff, shareUrl])

  const donationAmount = view ? view.amount : handoff?.amount
  const tipAmount = view?.tip ?? 0

  // --- Missing reference ----------------------------------------------------

  if (phase === 'missing') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Payment"
          message="We couldn't find a payment reference to confirm. If money left your account, don't worry — your receipt is emailed once payment is confirmed."
          onBack={() => navigate('/')}
          backLabel="Go home"
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
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        {/* ---- Pending / resolving ---- */}
        {(phase === 'resolving' || phase === 'pending') && (
          <>
            <Box sx={{ mb: 3, color: 'secondary.main', display: 'flex', justifyContent: 'center' }}>
              <Box aria-busy="true" aria-label="Loading payment confirmation" sx={{ width: '100%' }}><Skeleton variant="rounded" height={100} sx={{ mb: 2 }} /><Skeleton width="80%" sx={{ mx: 'auto' }} /><Skeleton width="55%" sx={{ mx: 'auto' }} /></Box>
            </Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
              Confirming your payment…
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto' }}>
              Hang tight — we're waiting for your bank or mobile money provider to confirm.
              This usually takes just a few seconds.
            </Typography>
          </>
        )}

        {/* ---- Succeeded ---- */}
        {phase === 'succeeded' && (
          <Box role="status" aria-live="polite">
            <DonationCelebration />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 900, mb: 1 }}>
              Thank you for showing up.
            </Typography>
            {donationAmount != null && (
              <Typography variant="h6" color="secondary.dark" sx={{ fontWeight: 800, mb: 1 }}>
                Your {formatCurrency(donationAmount, 'GHS')} donation is confirmed
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 1 }}>
              {handoff?.title
                ? `You’re now part of the story behind “${handoff.title}”.`
                : 'One act of kindness. A community moving forward together.'}
              {tipAmount > 0 && ` And thank you for the extra ${formatCurrency(tipAmount, 'GHS')} tip to support Ujimora.`}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 4, maxWidth: 360, mx: 'auto', whiteSpace: 'normal' }}>
              Your support is confirmed. You can return to your campaign whenever you’re ready.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<IosShareRoundedIcon />}
                onClick={handleShare}
                sx={{ fontWeight: 800 }}
              >
                Share this campaign
              </Button>
              <Button component={RouterLink} to={campaignPath} variant="text">
                Back to campaign
              </Button>
            </Box>
          </Box>
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
              {campaignSlug && (
                <Button
                  component={RouterLink}
                  to={donatePath(campaignSlug)}
                  variant="contained"
                  color="secondary"
                  startIcon={<ReplayRoundedIcon />}
                  sx={{ fontWeight: 800 }}
                >
                  Try again
                </Button>
              )}
              <Button component={RouterLink} to={campaignPath} variant="text">
                Back to campaign
              </Button>
            </Box>
          </>
        )}

        {/* ---- Timeout (still pending after polling) ---- */}
        {phase === 'timeout' && (
          <>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
              Still confirming your payment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 4 }}>
              We haven’t confirmed this payment yet. If you received a Paystack receipt, don’t pay
              again. Choose Keep checking to verify its status securely.
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
              <Button component={RouterLink} to={campaignPath} variant="text">
                Back to campaign
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

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message="Campaign link copied to clipboard"
      />
    </Container>
  )
}
