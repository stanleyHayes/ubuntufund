import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import { BrandedTextField as TextField, ErrorState, ItemNotFound, LoadingDots, SHAPE } from '@ubuntu-fund/ui'
import {
  DONOR_THANK_YOU_LIMITS,
  type DonorThankYouContent,
  type DonorThankYouPreview,
  type DonorThankYouState,
  type DonorThankYouView,
} from '@ubuntu-fund/types'
import { AccountHeading } from '@/components/account/AccountPage'
import { PublicationConsent } from '@/components/safety/PublicationConsent'
import { PublicationHeldNotice } from '@/components/safety/PublicationHeldNotice'
import { useCampaign } from '@/hooks/useCampaigns'
import { api } from '@/lib/api'
import { isPublicationHeld } from '@/lib/publicationDrafts'
import { useSeo } from '@/lib/seo'
import {
  EMPTY_THANK_YOU,
  THANK_YOU_STATUS,
  isDelivering,
  normalizeThankYou,
  sameThankYou,
  thankYouBlockText,
  validateThankYou,
} from '@/lib/donorThankYou'

/** How often delivery progress is read while a message is queued or sending. */
const POLL_MS = 4000
const ALL_TOUCHED = { subject: true, body: true, signature: true }

type Field = keyof DonorThankYouContent

const statusOf = (err: unknown) => {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : undefined
}
const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)
const donors = (count: number) => `${count} ${count === 1 ? 'donor' : 'donors'}`
const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const contentOf = (view: DonorThankYouView): DonorThankYouContent => ({ subject: view.subject, body: view.body, signature: view.signature })
/** Skin material for a panel: outline and frost only where the skin draws them. */
const MATERIAL_SX = {
  border: 'var(--neu-border)',
  backdropFilter: 'var(--neu-backdrop)',
  WebkitBackdropFilter: 'var(--neu-backdrop)',
} as const

export function ThankDonorsPage() {
  const { id = '' } = useParams<{ id: string }>()
  return <ThankDonorsContent key={id} campaignId={id} />
}

/**
 * One thank-you from a campaign's organizer or beneficiary to everyone who
 * gave. Ujimora resolves and emails the donors; the author only sees counts.
 */
function ThankDonorsContent({ campaignId }: { campaignId: string }) {
  useSeo({
    title: 'Thank your donors | Ujimora',
    description: 'Send one thank-you message to everyone who gave to your campaign.',
    path: `/campaigns/${encodeURIComponent(campaignId)}/thank-you`,
    robots: 'noindex, nofollow',
  })
  const { campaign } = useCampaign(campaignId)
  const [state, setState] = useState<DonorThankYouState | null>(null)
  const [loadError, setLoadError] = useState<{ status?: number; message: string } | null>(null)
  const [revision, setRevision] = useState(0)
  const [content, setContent] = useState<DonorThankYouContent>(EMPTY_THANK_YOU)
  // The draft as the server last saved it.
  const [saved, setSaved] = useState<DonorThankYouContent | null>(null)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [busy, setBusy] = useState<'save' | 'preview' | 'discard' | 'send' | 'retry' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null)
  const [held, setHeld] = useState(false)
  const [preview, setPreview] = useState<DonorThankYouPreview | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // The message being delivered, kept fresh while it is queued or sending.
  const [latest, setLatest] = useState<DonorThankYouView | null>(null)
  const hydrated = useRef(false)
  // One Idempotency-Key per Send click. Only "Try again" for that same click reuses it.
  const attempt = useRef<{ key: string; content: string } | null>(null)

  useEffect(() => {
    let active = true
    api.get<DonorThankYouState>(`/campaigns/${campaignId}/thank-you`)
      .then((next) => {
        if (!active) return
        setState(next)
        setLoadError(null)
        // Fill the form from the saved draft once; later reloads keep what is being typed.
        if (!hydrated.current) {
          hydrated.current = true
          if (next.draft) {
            setContent(contentOf(next.draft))
            setSaved(contentOf(next.draft))
          }
        }
      })
      .catch((err: unknown) => {
        if (active) setLoadError({ status: statusOf(err), message: messageOf(err, 'Could not load your thank-you message.') })
      })
    return () => { active = false }
  }, [campaignId, revision])

  const shown = latest ?? state?.history[0] ?? null
  const shownId = shown?.id
  const delivering = isDelivering(shown?.status)
  useEffect(() => {
    if (!shownId || !delivering) return
    let active = true
    let inFlight = false
    const timer = setInterval(() => {
      if (inFlight) return
      inFlight = true
      api.get<DonorThankYouView>(`/campaigns/${campaignId}/thank-you/${shownId}`)
        .then((view) => { if (active) setLatest(view) })
        .catch(() => { /* The next tick tries again. */ })
        .finally(() => { inFlight = false })
    }, POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [campaignId, shownId, delivering])

  const errors = validateThankYou(content)
  const valid = Object.keys(errors).length === 0
  const normalized = normalizeThankYou(content)
  const dirty = !saved || !sameThankYou(saved, normalized)
  const hasText = !!(content.subject || content.body || content.signature)
  const shownError = (field: Field) => Boolean(touched[field] && errors[field])

  function edit(field: Field, value: string) {
    setContent((current) => ({ ...current, [field]: value }))
    setNotice('')
    // A changed message is a new send, never a retry of an earlier click.
    attempt.current = null
  }

  async function saveDraft(): Promise<void> {
    const draft = await api.put<DonorThankYouView>(`/campaigns/${campaignId}/thank-you/draft`, normalized)
    setSaved(draft ? contentOf(draft) : normalized)
  }

  async function handleSave() {
    setTouched(ALL_TOUCHED)
    if (!valid) return
    setBusy('save'); setError(null); setNotice('')
    try {
      await saveDraft()
      setNotice('Draft saved.')
    } catch (err) {
      setError({ message: messageOf(err, 'Could not save your draft. Please try again.'), canRetry: false })
    } finally {
      setBusy(null)
    }
  }

  async function handlePreview() {
    setTouched(ALL_TOUCHED)
    if (!valid) return
    setBusy('preview'); setError(null)
    try {
      setPreview(await api.post<DonorThankYouPreview>(`/campaigns/${campaignId}/thank-you/preview`, normalized))
    } catch (err) {
      setError({ message: messageOf(err, 'Could not prepare the preview. Please try again.'), canRetry: false })
    } finally {
      setBusy(null)
    }
  }

  async function handleDiscard() {
    setBusy('discard'); setError(null); setNotice('')
    try {
      await api.delete(`/campaigns/${campaignId}/thank-you/draft`)
      setContent(EMPTY_THANK_YOU)
      setSaved(null)
      setTouched({})
      attempt.current = null
      setNotice('Draft discarded.')
    } catch (err) {
      setError({ message: messageOf(err, 'Could not discard the draft. Please try again.'), canRetry: false })
    } finally {
      setConfirmDiscard(false)
      setBusy(null)
    }
  }

  async function send(retrying = false) {
    const fingerprint = JSON.stringify(normalized)
    if (!retrying || attempt.current?.content !== fingerprint) attempt.current = { key: crypto.randomUUID(), content: fingerprint }
    const key = attempt.current.key
    setBusy('send'); setError(null); setHeld(false); setNotice('')
    try {
      // The server sends the saved draft, so save what is on screen first.
      if (dirty) await saveDraft()
      const view = await api.post<DonorThankYouView>(`/campaigns/${campaignId}/thank-you/send`, { automatedReviewConsent }, { 'Idempotency-Key': key })
      attempt.current = null
      setLatest(view)
      setContent(EMPTY_THANK_YOU)
      setSaved(null)
      setTouched({})
      setNotice('Your thank-you is on its way. Ujimora emails it to your donors.')
      setRevision((value) => value + 1)
    } catch (err) {
      if (isPublicationHeld(err)) {
        // Held for safety review: after approval, a new Send sends the same draft.
        attempt.current = null
        setHeld(true)
      } else {
        const status = statusOf(err)
        // Only an unknown outcome is worth retrying with the same key.
        const canRetry = status === undefined || status === 0 || status === 429 || status >= 500
        if (!canRetry) attempt.current = null
        setError({ message: messageOf(err, 'Could not send your thank-you. Please try again.'), canRetry })
        if (status === 409) setRevision((value) => value + 1)
      }
    } finally {
      setConfirmSend(false)
      setBusy(null)
    }
  }

  async function retryFailed(view: DonorThankYouView) {
    setBusy('retry'); setError(null); setNotice('')
    try {
      const result = await api.post<{ requeued: number }>(`/campaigns/${campaignId}/thank-you/${view.id}/retry`)
      const requeued = result?.requeued ?? 0
      setLatest({ ...view, status: 'sending', retryableCount: 0 })
      setNotice(`Trying ${requeued} failed ${requeued === 1 ? 'delivery' : 'deliveries'} again.`)
    } catch (err) {
      setError({ message: messageOf(err, 'Could not retry the failed deliveries. Please try again.'), canRetry: false })
    } finally {
      setBusy(null)
    }
  }

  const back = (
    <Button component={RouterLink} to={`/campaigns/${campaignId}`} startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 2, color: 'text.secondary' }}>
      Back to campaign
    </Button>
  )

  if (!state) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {back}
        {loadError ? (
          loadError.status === 404 ? (
            <ItemNotFound itemType="Campaign" message="We could not find this campaign, or you cannot thank its donors." />
          ) : (
            <ErrorState title="Could not load your thank-you" message={loadError.message} onRetry={() => { setLoadError(null); setRevision((value) => value + 1) }} />
          )
        ) : (
          <Box aria-busy="true" aria-label="Loading your thank-you message">
            <Skeleton width="45%" height={52} />
            <Skeleton width="70%" sx={{ mb: 3 }} />
            <Skeleton variant="rounded" height={360} sx={{ borderRadius: SHAPE.card }} />
          </Box>
        )}
      </Container>
    )
  }

  const recipients = state.estimatedRecipients
  const earlier = state.history.filter((item) => item.id !== shown?.id)

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      {back}
      <AccountHeading
        title="Thank your donors"
        description={campaign?.title ? `Send one thank-you to everyone who gave to “${campaign.title}”.` : 'Send one thank-you to everyone who gave to your campaign.'}
        icon={<VolunteerActivismRoundedIcon />}
      />

      {!state.eligible ? (
        <Alert severity="info" sx={{ mb: 3 }}>{thankYouBlockText(state.reason, state.sendsAllowed)}</Alert>
      ) : (
        <Box component="section" aria-labelledby="thank-you-compose-heading" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', ...MATERIAL_SX, minWidth: 0 }}>
          <Typography id="thank-you-compose-heading" component="h2" variant="h6" sx={{ fontWeight: 800 }}>
            Your message
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {state.trigger === 'payout_paid' ? 'A payout has been paid, so you can thank your donors now.' : 'The campaign has ended, so you can thank your donors now.'}{' '}
            {state.sendsAllowed > 1
              ? `This campaign can send ${Math.max(0, state.sendsAllowed - state.sendsUsed)} more thank-you messages.`
              : 'You can send one thank-you for this campaign.'}
          </Typography>
          <Alert severity="info" icon={<LockRoundedIcon fontSize="inherit" />} sx={{ mb: 3 }}>
            About {donors(recipients)} will receive this privately — they are emailed by Ujimora and you will not see their names or addresses.
          </Alert>
          <Stack spacing={2.5}>
            <TextField
              label="Subject"
              value={content.subject}
              onChange={(event) => edit('subject', event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
              error={shownError('subject')}
              helperText={shownError('subject') ? errors.subject : `${content.subject.length}/${DONOR_THANK_YOU_LIMITS.subject}`}
              disabled={busy === 'send'}
              fullWidth
              slotProps={{ htmlInput: { maxLength: DONOR_THANK_YOU_LIMITS.subject } }}
            />
            <TextField
              label="Message"
              value={content.body}
              onChange={(event) => edit('body', event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, body: true }))}
              error={shownError('body')}
              helperText={shownError('body') ? errors.body : `${content.body.length}/${DONOR_THANK_YOU_LIMITS.body} · Plain text. Line breaks are kept.`}
              disabled={busy === 'send'}
              fullWidth
              multiline
              minRows={8}
              slotProps={{ htmlInput: { maxLength: DONOR_THANK_YOU_LIMITS.body } }}
            />
            <TextField
              label="Signature (optional)"
              value={content.signature}
              onChange={(event) => edit('signature', event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, signature: true }))}
              error={shownError('signature')}
              helperText={shownError('signature') ? errors.signature : `${content.signature.length}/${DONOR_THANK_YOU_LIMITS.signature} · For example: Ama and the clinic team`}
              disabled={busy === 'send'}
              fullWidth
              slotProps={{ htmlInput: { maxLength: DONOR_THANK_YOU_LIMITS.signature } }}
            />
          </Stack>
          <Box sx={{ mt: 2.5 }}>
            <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3 }}>
            <Button variant="contained" color="secondary" disabled={busy !== null} onClick={() => { setTouched(ALL_TOUCHED); if (valid) setConfirmSend(true) }}>
              Send to donors
            </Button>
            <Button variant="outlined" disabled={busy !== null} onClick={() => void handlePreview()}>
              {busy === 'preview' ? 'Preparing…' : 'Preview'}
            </Button>
            <Button disabled={busy !== null || (!!saved && !dirty)} onClick={() => void handleSave()}>
              {busy === 'save' ? 'Saving…' : saved && !dirty ? 'Draft saved' : 'Save draft'}
            </Button>
            {(saved || hasText) && (
              <Button color="error" disabled={busy !== null} onClick={() => setConfirmDiscard(true)}>
                Discard
              </Button>
            )}
          </Box>
          {saved && dirty && hasText && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              You have unsaved changes.
            </Typography>
          )}
        </Box>
      )}

      {/* Beside the buttons that caused them, so they stay in view on a phone. */}
      {notice && <Alert severity="success" role="status" sx={{ mt: 3 }}>{notice}</Alert>}
      {error && (
        <Alert
          severity="error"
          sx={{ mt: 3 }}
          action={error.canRetry ? <Button color="inherit" disabled={busy !== null} onClick={() => void send(true)}>Try again</Button> : undefined}
        >
          {error.message}
        </Alert>
      )}
      {held && <PublicationHeldNotice retry="select Send to donors again with the same message" sx={{ mt: 3 }} />}

      {shown && <DeliveryCard view={shown} retrying={busy === 'retry'} disabled={busy !== null} onRetry={() => void retryFailed(shown)} />}

      {earlier.length > 0 && (
        <Box component="section" aria-labelledby="thank-you-history-heading" sx={{ mt: 4, p: { xs: 2.5, md: 3 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', ...MATERIAL_SX, minWidth: 0 }}>
          <Typography id="thank-you-history-heading" component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Earlier messages
          </Typography>
          {earlier.map((item) => (
            <Box key={item.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.subject}</Typography>
                <Chip size="small" label={THANK_YOU_STATUS[item.status].label} color={THANK_YOU_STATUS[item.status].tone} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {[formatDate(item.submittedAt), `${item.sentCount} sent`, `${item.skippedCount} skipped`, `${item.failedCount} failed`].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={confirmSend} onClose={() => busy === null && setConfirmSend(false)} aria-labelledby="send-thank-you-title" maxWidth="xs" fullWidth>
        <DialogTitle id="send-thank-you-title">Send your thank-you?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            About {donors(recipients)} will receive it by email from Ujimora.{' '}
            {state.sendsAllowed > 1
              ? `It uses one of this campaign’s ${state.sendsAllowed} thank-you messages`
              : 'You can send a thank-you only once for this campaign'}
            , and it cannot be changed or recalled after sending.
          </DialogContentText>
          <Typography sx={{ mt: 2, fontWeight: 700, overflowWrap: 'anywhere' }}>{normalized.subject}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={busy !== null} onClick={() => setConfirmSend(false)}>Keep editing</Button>
          <Button variant="contained" color="secondary" disabled={busy !== null} onClick={() => void send()}>
            {busy === 'send' ? <><LoadingDots size={6} /> <span>Sending…</span></> : 'Send now'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDiscard} onClose={() => busy === null && setConfirmDiscard(false)} aria-labelledby="discard-thank-you-title" maxWidth="xs" fullWidth>
        <DialogTitle id="discard-thank-you-title">Discard this draft?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your message is deleted. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={busy !== null} onClick={() => setConfirmDiscard(false)}>Keep it</Button>
          <Button color="error" variant="contained" disabled={busy !== null} onClick={() => void handleDiscard()}>
            {busy === 'discard' ? 'Discarding…' : 'Discard draft'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!preview} onClose={() => setPreview(null)} aria-labelledby="preview-thank-you-title" maxWidth="sm" fullWidth>
        <DialogTitle id="preview-thank-you-title">Preview</DialogTitle>
        {preview && (
          <DialogContent>
            <Typography variant="overline" color="text.secondary">Subject</Typography>
            <Typography sx={{ fontWeight: 700, mb: 2, overflowWrap: 'anywhere' }}>{preview.subject}</Typography>
            <Typography variant="overline" color="text.secondary">Email</Typography>
            {preview.html ? (
              // The branded email exactly as donors receive it. No scripts, forms or same-origin access.
              <Box
                component="iframe"
                title="Email preview"
                sandbox=""
                srcDoc={preview.html}
                sx={{ display: 'block', width: '100%', height: { xs: 520, sm: 600 }, border: 'var(--neu-border)', borderRadius: SHAPE.sm, bgcolor: '#F2EFEA' }}
              />
            ) : (
              <Typography
                component="div"
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', p: 2, borderRadius: SHAPE.sm, bgcolor: 'action.hover', lineHeight: 1.7 }}
              >
                {preview.text}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              This is exactly what donors receive. Each email has its own unsubscribe link, and mail apps that only show plain text get the same words.
            </Typography>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreview(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

function DeliveryCard({ view, retrying, disabled, onRetry }: {
  view: DonorThankYouView
  retrying: boolean
  disabled: boolean
  onRetry: () => void
}) {
  const status = THANK_YOU_STATUS[view.status]
  const delivering = isDelivering(view.status)
  const processed = view.sentCount + view.failedCount + view.skippedCount
  const total = view.recipientCount
  const summary = view.status === 'sent'
    ? `Delivered to ${donors(view.sentCount)}.`
    : view.status === 'partially_sent'
      ? `Delivered to ${view.sentCount} of ${donors(total)}.`
      : view.status === 'failed' ? 'We could not deliver this message.' : ''
  return (
    <Box component="section" aria-labelledby="thank-you-delivery-heading" sx={{ mt: 4, p: { xs: 2.5, md: 3 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-inset)', ...MATERIAL_SX, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography id="thank-you-delivery-heading" component="h2" variant="h6" sx={{ fontWeight: 800 }}>
          Your thank-you
        </Typography>
        <Chip size="small" label={status.label} color={status.tone} sx={{ fontWeight: 700 }} />
      </Box>
      <Typography sx={{ mt: 1, fontWeight: 700, overflowWrap: 'anywhere' }}>{view.subject}</Typography>
      {view.submittedAt && <Typography variant="caption" color="text.secondary">Submitted on {formatDate(view.submittedAt)}</Typography>}
      <Box role="status" aria-live="polite" sx={{ mt: 2 }}>
        {delivering ? (
          <>
            <Typography variant="body2">
              {view.status === 'queued' || total === 0 ? 'Queued. Delivery starts in a moment.' : `Sending… ${processed} of ${total} done.`}
            </Typography>
            <LinearProgress
              aria-label="Delivery progress"
              variant={total > 0 ? 'determinate' : 'indeterminate'}
              value={total > 0 ? Math.min(100, (processed / total) * 100) : undefined}
              sx={{ mt: 1, height: 6, borderRadius: SHAPE.bar }}
            />
          </>
        ) : (
          <Typography variant="body2">{summary}</Typography>
        )}
      </Box>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
          mt: 2,
          mb: 0,
          '& > div': { p: 1.5, borderRadius: SHAPE.sm, bgcolor: 'action.hover' },
          '& dt': { fontSize: '0.78rem', color: 'text.secondary' },
          '& dd': { m: 0, fontWeight: 800, fontSize: '1.2rem' },
        }}
      >
        <div><dt>Sent</dt><dd>{view.sentCount}</dd></div>
        <div><dt>Skipped (opted out or no longer eligible)</dt><dd>{view.skippedCount}</dd></div>
        <div><dt>Failed</dt><dd>{view.failedCount}</dd></div>
      </Box>
      {!delivering && view.retryableCount > 0 && (
        <Button variant="outlined" sx={{ mt: 2 }} disabled={disabled} onClick={onRetry}>
          {retrying ? 'Retrying…' : 'Retry failed deliveries'}
        </Button>
      )}
    </Box>
  )
}
