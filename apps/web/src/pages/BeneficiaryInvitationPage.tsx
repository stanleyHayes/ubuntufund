import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { BrandedTextField as TextField, formatCurrency, LoadingDots, SHAPE } from '@ubuntu-fund/ui'
import type { BeneficiaryInvitationPreview } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { EmailVerificationNotice } from '@/components/account/EmailVerificationNotice'
import { api } from '@/lib/api'
import { useSeo } from '@/lib/seo'
import {
  RELATIONSHIP_LABELS,
  forgetInvitationToken,
  isInvitationToken,
  partyLabel,
  readStoredInvitationToken,
  storeInvitationToken,
} from '@/lib/onBehalf'

const RETURN_PATH = '/beneficiary-invitation'
const DECLINE_REASON_MAX = 500

type Phase =
  | { kind: 'missing' }
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; preview: BeneficiaryInvitationPreview }
  | { kind: 'accepted'; campaignId: string; status: string }
  | { kind: 'declined' }

const statusOf = (err: unknown) => {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : undefined
}
const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)
const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/** Where the money goes, told to the person or organization it is raised for. */
function moneyText(preview: BeneficiaryInvitationPreview): string {
  const org = preview.beneficiaryType === 'organization'
  if (preview.payoutArrangement === 'organization')
    return `${preview.organizerName} asks to receive the donations on your behalf. If you accept, you agree that they request the payouts for this campaign.`
  return `Donations are paid out to ${org ? 'your organization, into its' : 'you, into your'} own verified account. ${preview.organizerName} manages the campaign but cannot withdraw the money.`
}

function statusNotice(preview: BeneficiaryInvitationPreview): { severity: 'info' | 'warning'; text: string } | null {
  switch (preview.status) {
    case 'expired': return { severity: 'warning', text: `This invitation has expired. Ask ${preview.organizerName} to send a new one.` }
    case 'superseded': return { severity: 'warning', text: `This invitation was replaced by a newer one. Use the latest invitation email from ${preview.organizerName}.` }
    case 'accepted': return { severity: 'info', text: 'This invitation has already been accepted. Campaigns run for you are listed in My campaigns.' }
    case 'declined': return { severity: 'info', text: 'This invitation was declined.' }
    case 'revoked': return { severity: 'info', text: 'This invitation is no longer active.' }
    default: return null
  }
}

/**
 * The page a beneficiary invitation email links to: review the campaign that
 * someone created for you, then accept (signed in) or decline (no account
 * needed). The token travels in the link's fragment and request bodies only.
 */
export function BeneficiaryInvitationPage() {
  useSeo({
    title: 'Campaign invitation | Ujimora',
    description: 'Review a campaign someone created for you on Ujimora, then accept or decline it.',
    path: RETURN_PATH,
    robots: 'noindex, nofollow',
  })
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  // From the email link, or kept in this tab while the visitor signed in.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || readStoredInvitationToken())
  const [phase, setPhase] = useState<Phase>(() => (isInvitationToken(token) ? { kind: 'loading' } : { kind: 'missing' }))
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [acceptError, setAcceptError] = useState<{ status?: number; message: string } | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declineError, setDeclineError] = useState('')

  useEffect(() => {
    // Keep the token out of the address bar, browser history and later Referer headers.
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname)
    // A newer link replaces a token kept from an earlier visit; an unusable one is dropped.
    const stored = readStoredInvitationToken()
    if (stored && (stored !== token || !isInvitationToken(token))) forgetInvitationToken()
  }, [token])

  useEffect(() => {
    if (!isInvitationToken(token)) return
    let active = true
    api.post<BeneficiaryInvitationPreview>('/beneficiary-invitations/preview', { token })
      .then((preview) => {
        if (!active) return
        if (preview.status !== 'pending') forgetInvitationToken()
        setPhase({ kind: 'ready', preview })
      })
      .catch((err: unknown) => {
        if (!active) return
        if (statusOf(err) === 404) {
          forgetInvitationToken()
          setPhase({ kind: 'invalid' })
        } else setPhase({ kind: 'error', message: messageOf(err, 'Could not load this invitation. Please try again.') })
      })
    return () => { active = false }
  }, [token, revision])

  function continueToAccount(path: '/login' | '/register') {
    storeInvitationToken(token)
    navigate(path, { state: { from: { pathname: RETURN_PATH } } })
  }

  function switchAccount() {
    logout()
    continueToAccount('/login')
  }

  async function accept() {
    if (!isAuthenticated) { continueToAccount('/login'); return }
    setBusy('accept')
    setAcceptError(null)
    try {
      const result = await api.post<{ campaignId: string; status: string }>('/beneficiary-invitations/accept', { token })
      forgetInvitationToken()
      setPhase({ kind: 'accepted', campaignId: result.campaignId, status: result.status })
    } catch (err) {
      const status = statusOf(err)
      setAcceptError({ status, message: messageOf(err, 'Could not accept the invitation. Please try again.') })
      // Already decided, replaced or expired: show where the invitation now stands.
      if (status === 409 || status === 410) {
        forgetInvitationToken()
        setRevision((value) => value + 1)
      }
    } finally {
      setBusy(null)
    }
  }

  async function decline() {
    setBusy('decline')
    setDeclineError('')
    try {
      const reason = declineReason.trim()
      await api.post('/beneficiary-invitations/decline', { token, ...(reason ? { reason } : {}) })
      forgetInvitationToken()
      setDeclineOpen(false)
      setPhase({ kind: 'declined' })
    } catch (err) {
      const status = statusOf(err)
      if (status === 409 || status === 410) {
        forgetInvitationToken()
        setDeclineOpen(false)
        setRevision((value) => value + 1)
      } else setDeclineError(messageOf(err, 'Could not decline the invitation. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  let content: ReactNode
  if (phase.kind === 'missing' || phase.kind === 'invalid') {
    content = (
      <>
        <Heading>{phase.kind === 'invalid' ? 'This invitation link is not valid' : 'Open your invitation link'}</Heading>
        <Alert severity="warning">
          {phase.kind === 'invalid'
            ? 'Open the complete link from your email, or ask the organizer to send a new invitation.'
            : 'Open the complete link from your invitation email. If you refreshed this page, open the email link again.'}
        </Alert>
      </>
    )
  } else if (phase.kind === 'loading') {
    content = (
      <Box aria-busy="true" aria-label="Loading the invitation">
        <Skeleton width="70%" height={48} />
        <Skeleton variant="rounded" height={260} sx={{ mt: 3, borderRadius: SHAPE.card }} />
      </Box>
    )
  } else if (phase.kind === 'error') {
    content = (
      <Alert severity="error" action={<Button color="inherit" onClick={() => { setPhase({ kind: 'loading' }); setRevision((value) => value + 1) }}>Retry</Button>}>
        {phase.message}
      </Alert>
    )
  } else if (phase.kind === 'accepted') {
    content = (
      <>
        <Heading>You accepted this campaign</Heading>
        <Alert severity="success" role="status">
          Thank you. {phase.status === 'active' || phase.status === 'funded'
            ? 'The campaign is live and can collect donations.'
            : phase.status === 'pending_review'
              ? 'It is waiting for a staff review before it goes live.'
              : 'The organizer has been told.'}
        </Alert>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 3 }}>
          <Button component={RouterLink} to={`/campaigns/${phase.campaignId}`} variant="contained" color="secondary">View the campaign</Button>
          <Button component={RouterLink} to="/my-campaigns">Go to My campaigns</Button>
        </Box>
      </>
    )
  } else if (phase.kind === 'declined') {
    content = (
      <>
        <Heading>You declined this campaign</Heading>
        <Alert severity="info" role="status">
          We let the organizer know. The campaign cannot collect or pay out money for you.
        </Alert>
        <Button component={RouterLink} to="/" sx={{ mt: 3 }}>Go to Ujimora</Button>
      </>
    )
  } else {
    const preview = phase.preview
    const notice = statusNotice(preview)
    const verifyEmail = acceptError?.status === 403 && /verify/i.test(acceptError.message)
    content = (
      <>
        <Heading>{preview.organizerName} created a campaign for {preview.beneficiaryName}</Heading>
        {notice ? (
          <Alert severity={notice.severity} sx={{ mb: 3 }}>{notice.text}</Alert>
        ) : (
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
            Please check the details below. Nothing is paid out unless you accept. You can also decline.
          </Typography>
        )}

        <Box component="section" aria-labelledby="invitation-campaign-title" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', minWidth: 0 }}>
          <Typography id="invitation-campaign-title" component="h2" variant="h5" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>
            {preview.campaignTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{preview.campaignSummary}</Typography>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '190px minmax(0, 1fr)' },
              columnGap: 2,
              rowGap: { xs: 0.25, sm: 1.25 },
              mt: 2.5,
              mb: 0,
              '& dt': { color: 'text.secondary', fontSize: '0.85rem', fontWeight: 600, mt: { xs: 1, sm: 0 } },
              '& dd': { m: 0, overflowWrap: 'anywhere' },
            }}
          >
            <dt>Goal</dt>
            <dd>{formatCurrency(preview.goalAmount, preview.currency)}</dd>
            <dt>Organized by</dt>
            <dd>{preview.organizerName}</dd>
            <dt>For</dt>
            <dd>{preview.beneficiaryName} · {partyLabel(preview.beneficiaryType)}</dd>
            <dt>Relationship to the organizer</dt>
            <dd>{RELATIONSHIP_LABELS[preview.relationship] ?? preview.relationship}</dd>
            <dt>Why they are raising money</dt>
            <Box component="dd" sx={{ whiteSpace: 'pre-line' }}>{preview.reason}</Box>
            {preview.status === 'pending' && <><dt>Invitation expires</dt><dd>{formatDate(preview.expiresAt)}</dd></>}
          </Box>
        </Box>

        {preview.status === 'pending' && (
          <>
            <Box component="section" aria-labelledby="invitation-money-heading" sx={{ mt: 3 }}>
              <Typography id="invitation-money-heading" component="h2" variant="h6" sx={{ fontWeight: 800 }}>Where the money goes</Typography>
              <Typography sx={{ mt: 0.5, maxWidth: 680 }}>{moneyText(preview)}</Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 3 }}>
              <AlertTitle>Before you accept</AlertTitle>
              Accepting confirms that you know about this campaign and agree that {preview.organizerName} runs it for{' '}
              {preview.beneficiaryType === 'organization' ? 'your organization' : 'you'}.{' '}
              {preview.requiredAccountType === 'organization'
                ? 'Accept from your organization’s Ujimora account'
                : 'Accept from a personal Ujimora account'}{' '}
              that uses the email address this invitation was sent to.
            </Alert>

            {acceptError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {acceptError.message}
                {verifyEmail && <> <Link component={RouterLink} to="/settings#notifications">Verify your email in Settings</Link>.</>}
              </Alert>
            )}
            {verifyEmail && <Box sx={{ mt: 2 }}><EmailVerificationNotice reason="Accepting a campaign needs a verified email address." /></Box>}

            {isAuthenticated ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                  Signed in as {user?.email ?? user?.name}.{' '}
                  <Link component="button" type="button" onClick={switchAccount} sx={{ verticalAlign: 'baseline' }}>Use another account</Link>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.5 }}>
                  <Button variant="contained" color="secondary" disabled={busy !== null} onClick={() => void accept()}>
                    {busy === 'accept' ? <><LoadingDots size={6} /> <span>Accepting…</span></> : 'Accept campaign'}
                  </Button>
                  <Button variant="outlined" disabled={busy !== null} onClick={() => { setDeclineError(''); setDeclineOpen(true) }}>Decline</Button>
                </Box>
              </>
            ) : (
              <>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 3 }}>
                  <Button variant="contained" color="secondary" disabled={authLoading || busy !== null} onClick={() => void accept()}>Sign in to accept</Button>
                  <Button variant="outlined" disabled={authLoading || busy !== null} onClick={() => continueToAccount('/register')}>Create an account</Button>
                  <Button disabled={busy !== null} onClick={() => { setDeclineError(''); setDeclineOpen(true) }}>Decline</Button>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 640 }}>
                  Declining does not need an account. New to Ujimora? Create an account with the address this invitation
                  was sent to and verify it, then open the invitation link again.
                </Typography>
              </>
            )}

            <Dialog open={declineOpen} onClose={() => busy === null && setDeclineOpen(false)} aria-labelledby="decline-invitation-title" maxWidth="sm" fullWidth>
              <DialogTitle id="decline-invitation-title">Decline this campaign?</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  We let {preview.organizerName} know that you declined. The campaign cannot collect or pay out money for
                  you, and this invitation stops working.
                </DialogContentText>
                <TextField
                  label="Reason (optional)"
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                  helperText={`${declineReason.length}/${DECLINE_REASON_MAX} · Only Ujimora’s team sees this.`}
                  multiline
                  minRows={3}
                  fullWidth
                  disabled={busy !== null}
                  sx={{ mt: 2.5 }}
                  slotProps={{ htmlInput: { maxLength: DECLINE_REASON_MAX } }}
                />
                {declineError && <Alert severity="error" sx={{ mt: 2 }}>{declineError}</Alert>}
              </DialogContent>
              <DialogActions>
                <Button disabled={busy !== null} onClick={() => setDeclineOpen(false)}>Cancel</Button>
                <Button color="error" variant="contained" disabled={busy !== null} onClick={() => void decline()}>
                  {busy === 'decline' ? 'Declining…' : 'Decline campaign'}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <meta name="referrer" content="no-referrer" />
      <Typography variant="overline" color="text.secondary">Campaign invitation</Typography>
      {content}
    </Container>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 2, fontSize: { xs: '1.6rem', md: '2.1rem' }, overflowWrap: 'anywhere' }}>
      {children}
    </Typography>
  )
}
