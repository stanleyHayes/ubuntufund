import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Link, Stack, Typography } from '@mui/material'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded'
import { SHAPE } from '@ubuntu-fund/ui'
import {
  describePublicationReview,
  parsePublicationReviewPage,
  type PublicationAction,
  type PublicationReviewItem,
  type PublicationReviewStage,
  type PublicationStepState,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { clearWithdrawnProfileImages } from '@/lib/publicationDrafts'
import { useAuth } from '@/context/AuthContext'

/** The list API's default page. */
const PAGE_SIZE = 25
/**
 * The list API has no action filter, so a form's own kinds of change are picked
 * here from the author's latest submissions (the API's largest page). Older
 * ones stay reachable in Settings, which lists every kind page by page.
 */
const FILTERED_PAGE_SIZE = 100

/** Skin material for a card: outline and frost only where the skin draws them. */
const CARD_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  p: 2,
  minWidth: 0,
  overflowWrap: 'anywhere',
  borderRadius: SHAPE.card,
  bgcolor: 'background.paper',
  boxShadow: 'var(--neu-inset)',
  border: 'var(--neu-border)',
  backdropFilter: 'var(--neu-backdrop)',
  WebkitBackdropFilter: 'var(--neu-backdrop)',
} as const

const STEP_ICON = {
  complete: CheckCircleRoundedIcon,
  current: RadioButtonCheckedRoundedIcon,
  upcoming: RadioButtonUncheckedRoundedIcon,
  failed: CancelRoundedIcon,
  // Replaced or withdrawn: stopped unpublished, neither done nor failed.
  skipped: RemoveCircleRoundedIcon,
} as const
/** Text-grade tones, so the tracker stays legible in every skin and mode. */
const STEP_TONE: Record<PublicationStepState, string> = { complete: 'var(--text-success)', current: 'var(--text-info)', upcoming: 'text.disabled', failed: 'var(--text-error)', skipped: 'text.secondary' }
const LINE_TONE: Record<PublicationStepState, string> = { ...STEP_TONE, upcoming: 'divider', skipped: 'divider' }
const LABEL_TONE: Record<PublicationStepState, string> = { complete: 'text.primary', current: 'text.primary', upcoming: 'text.secondary', failed: 'var(--text-error)', skipped: 'text.secondary' }
/**
 * Each step's state in words for screen readers, since its icon is decorative:
 * `aria-current` already names the current step, and a failed or skipped
 * step's label (Declined, Replaced, Withdrawn) says it.
 */
const STEP_STATE_TEXT: Record<PublicationStepState, string> = { complete: ', done', current: '', upcoming: ', not yet', failed: '', skipped: '' }
/** Read by screen readers, never shown. */
const HIDDEN = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', border: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
/**
 * At most `lines` lines, then an ellipsis. Unlike `noWrap`, the text still
 * wraps, so a long title never widens the page the list sits in.
 */
const clamp = (lines: number) => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) as const

/** The kind of change and its subject on one line, e.g. "Comment · Thank you all". */
const titleOf = ({ label, subject }: { label: string; subject: string }) => (subject ? `${label} · ${subject}` : label)
/**
 * Approval publishes it by itself. The API says so only while publishing on
 * approval is switched on, so a list read while it is off (where a replaced,
 * withdrawn or author-published version still reports its `publication`)
 * never claims approval publishes anything.
 */
const publishesItself = (item: PublicationReviewItem) => item.publishOnApproval === true
const statusOf = (err: unknown) => (err as { status?: unknown } | null)?.status

/**
 * The author's own publication reviews as compact status cards: the kind of
 * change and its subject, a Submitted → In review → Approved (or Declined)
 * tracker, with a Published step when approval publishes it by itself, the
 * reviewer's note and what to do next. A version that is not published yet can
 * be withdrawn from its card. Never the submitted content itself. `actions`
 * narrows the list to one form's own kinds of change; without it (Settings)
 * every kind is listed.
 */
export function PublicationReviews({ actions }: { actions?: readonly PublicationAction[] }) {
  const { user } = useAuth()
  return <ViewerReviews key={user?.id ?? 'guest'} userId={user?.id} actions={actions} />
}
function ViewerReviews({ userId, actions }: { userId?: string; actions?: readonly PublicationAction[] }) {
  // A string, so an inline `actions` array does not reload the list on every render.
  const only = actions?.length ? actions.join(' ') : ''
  const headingId = useId(), dialogTitleId = useId(), cardId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  /** Each card's title, so focus can return to the version a withdrawal was about. */
  const titleIdOf = (id: string) => `${cardId}-${id}`
  // Where focus goes once the withdraw dialog has closed after a settled request.
  const focusAfterClose = useRef<string | null>(null)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const [items, setItems] = useState<PublicationReviewItem[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [older, setOlder] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  // Withdrawing: the version asked about (kept while the dialog closes), the dialog, and how the request went.
  const [target, setTarget] = useState<PublicationReviewItem | null>(null), [confirming, setConfirming] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false), [withdrawError, setWithdrawError] = useState('')
  // Why a withdrawal was refused (409), shown on that version's card.
  const [refusals, setRefusals] = useState<Readonly<Record<string, string>>>({})
  // Read out once a withdrawal settles: its card changes, but focus is elsewhere.
  const [announcement, setAnnouncement] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = parsePublicationReviewPage(await api.get<unknown>(only ? `/publication-reviews?page=1&pageSize=${FILTERED_PAGE_SIZE}` : `/publication-reviews?page=${page}`))
      if (!data) throw new Error('Invalid review response')
      const kinds = new Set(only.split(' '))
      setItems(only ? data.items.filter(item => kinds.has(item.action)) : data.items); setTotal(data.total)
      setOlder(!!only && data.total > data.items.length); setError('')
    }
    catch { setItems([]); setTotal(0); setOlder(false); setError('Could not load your publication reviews. Select Refresh to try again.') }
    finally { setLoading(false) }
  }, [page, only])
  useEffect(() => { void load() }, [load])
  function askToWithdraw(item: PublicationReviewItem) {
    setTarget(item); setWithdrawError(''); setConfirming(true)
  }
  async function withdraw() {
    if (!target) return
    const { id } = target
    setWithdrawing(true); setWithdrawError(''); setAnnouncement('')
    // Settled: '' once withdrawn, or why it was refused. A refusal means the version moved on meanwhile (published, replaced or declined).
    const refusal = await api.post(`/publication-reviews/${encodeURIComponent(id)}/withdraw`).then(
      () => '',
      (err: unknown) => (statusOf(err) === 409 ? (err instanceof Error && err.message) || "This version can't be withdrawn now." : null),
    )
    if (!live.current) return
    setWithdrawing(false)
    // Anything else may never have reached the API: the dialog stays open to try again.
    if (refusal === null) { setWithdrawError('Could not withdraw it. Check your connection and try again.'); return }
    // This browser keeps a held profile image to save again; a withdrawn one must not come back in the image editor.
    if (refusal === '' && target.action === 'account.profile' && userId) clearWithdrawnProfileImages(userId, target.mediaUrls ?? [])
    setRefusals(({ [id]: _previous, ...rest }) => (refusal ? { ...rest, [id]: refusal } : rest))
    setAnnouncement(refusal || "Withdrawn. It won't be published.")
    // Its Withdraw button goes away, so focus returns to the version's card instead (see the dialog's onExited).
    focusAfterClose.current = id
    setConfirming(false)
    // The card shows where the version stands now.
    void load()
  }
  /** Once the dialog has closed: the card of the version just withdrawn (or refused), or the list's heading if it is gone. */
  function restoreFocus() {
    const id = focusAfterClose.current
    focusAfterClose.current = null
    if (id) (document.getElementById(titleIdOf(id)) ?? heading.current)?.focus()
  }
  return <Stack component="section" aria-labelledby={headingId} spacing={1.5} sx={{ py: 2, minWidth: 0 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <Typography ref={heading} id={headingId} variant="h6" tabIndex={-1}>Publication reviews</Typography>
      <Button size="small" startIcon={<RefreshRoundedIcon />} disabled={loading} onClick={() => { setRefusals({}); void load() }} aria-label="Refresh publication reviews">Refresh</Button>
    </Box>
    {/* With publishing on approval on, approval publishes most changes by itself; otherwise (switched off, live sessions, versions held before it) they go public once their author submits them again. */}
    <Typography variant="body2" color="text.secondary">
      {items.some(publishesItself) ? "Held changes stay private until they're approved." : 'Held changes stay private until they are published.'}
    </Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {/* A reload keeps the cards in place (busy), so focus on one is never lost while it refreshes. */}
    {loading && !items.length ? <Typography color="text.secondary">Loading reviews…</Typography> : items.length > 0 && (
      <Box component="ul" aria-busy={loading || undefined} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, m: 0, p: 0, listStyle: 'none' }}>
        {items.map(item => <ReviewCard key={item.id} review={item} titleId={titleIdOf(item.id)} refusal={refusals[item.id]}
          onWithdraw={item.canWithdraw ? () => askToWithdraw(item) : undefined} />)}
      </Box>
    )}
    {!loading && !items.length && !error && <Typography color="text.secondary">Nothing waiting for review.</Typography>}
    {older && <Typography variant="body2" color="text.secondary">
      Only your latest submissions are listed here. <Link href="/settings#privacy" target="_blank" rel="noopener">See all in Settings (opens in a new tab)</Link>
    </Typography>}
    {/* Kept past page 1, so a list that shrank meanwhile never strands the author on an empty page. */}
    {!only && (total > PAGE_SIZE || page > 1) && <Stack direction="row" spacing={1}>
      <Button disabled={loading || !!error || page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
      <Button disabled={loading || !!error || page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next</Button>
    </Stack>}
    <Box role="status" aria-live="polite" sx={HIDDEN}>{announcement}</Box>
    <Dialog open={confirming} onClose={() => !withdrawing && setConfirming(false)} aria-labelledby={dialogTitleId} maxWidth="xs" fullWidth
      slotProps={{ transition: { onExited: restoreFocus } }}>
      <DialogTitle id={dialogTitleId}>Withdraw this version?</DialogTitle>
      <DialogContent>
        <DialogContentText>It won't be published. You can submit it again later for a new review.</DialogContentText>
        {target && <Typography sx={{ mt: 2, fontWeight: 700, overflowWrap: 'anywhere' }}>{titleOf(describePublicationReview(target))}</Typography>}
        {withdrawError && <Alert severity="error" sx={{ mt: 2 }}>{withdrawError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button disabled={withdrawing} onClick={() => setConfirming(false)}>Keep it</Button>
        <Button color="error" variant="contained" disabled={withdrawing} onClick={() => void withdraw()}>{withdrawing ? 'Withdrawing…' : 'Withdraw'}</Button>
      </DialogActions>
    </Dialog>
  </Stack>
}

function ReviewCard({ review, titleId, refusal, onWithdraw }: { review: PublicationReviewItem; titleId: string; refusal?: string; onWithdraw?: () => void }) {
  const described = describePublicationReview(review)
  const { label, subject, note, stage } = described
  return <Box component="li" sx={CARD_SX}>
    {/* Focusable only from code: where focus lands after this version's withdrawal. */}
    <Typography id={titleId} tabIndex={-1} title={subject ? titleOf(described) : undefined} sx={{ fontWeight: 700, ...clamp(1) }}>
      {label}
      {subject && <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>{` · ${subject}`}</Box>}
    </Typography>
    <ReviewSteps stage={stage} />
    {note && <ReviewNote text={note} />}
    {stage.hint && <Typography variant="body2">{stage.hint}</Typography>}
    {stage.support && <Typography variant="caption" color="text.secondary">{stage.support}</Typography>}
    {/* Not a live region: the list's status region reads it out once. */}
    {refusal && <Alert severity="warning" role="note">{refusal}</Alert>}
    {onWithdraw && <Button size="small" variant="outlined" onClick={onWithdraw} aria-label={`Withdraw ${titleOf(described)}`} sx={{ alignSelf: 'flex-start' }}>Withdraw</Button>}
  </Box>
}

/** Labels sit under their icons, so the steps share the width and read at phone size. */
function ReviewSteps({ stage }: { stage: PublicationReviewStage }) {
  return <Box component="ol" aria-label={`Review status: ${stage.label}`} sx={{ display: 'flex', m: 0, p: 0, listStyle: 'none' }}>
    {stage.steps.map((step, index) => {
      const Icon = STEP_ICON[step.state]
      const next = stage.steps[index + 1]
      return <Box component="li" key={step.key} aria-current={step.state === 'current' ? 'step' : undefined}
        sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {/* Each connector is two halves meeting at the column edge, so their ends stay square. */}
        <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}>
          <Box sx={{ flex: 1, height: 2, bgcolor: index ? LINE_TONE[step.state] : 'transparent' }} />
          <Icon sx={{ fontSize: 22, mx: 0.5, color: STEP_TONE[step.state] }} />
          <Box sx={{ flex: 1, height: 2, bgcolor: next ? LINE_TONE[next.state] : 'transparent' }} />
        </Box>
        <Typography component="span" sx={{ mt: 0.5, fontSize: '0.78rem', lineHeight: 1.3, fontWeight: step.state === 'upcoming' ? 500 : 700, color: LABEL_TONE[step.state] }}>
          {step.label}
        </Typography>
        {step.detail && <Typography component="span" sx={{ fontSize: '0.72rem', lineHeight: 1.3, color: 'text.secondary' }}>{step.detail}</Typography>}
        {STEP_STATE_TEXT[step.state] && <Box component="span" sx={HIDDEN}>{STEP_STATE_TEXT[step.state]}</Box>}
      </Box>
    })}
  </Box>
}

/** The reviewer's note, two lines until the author asks for the rest. */
function ReviewNote({ text }: { text: string }) {
  const id = useId()
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false), [clipped, setClipped] = useState(false)
  // Measured rather than guessed from its length: whether two lines cut the
  // note off depends on the card's width.
  useLayoutEffect(() => {
    const note = ref.current
    if (!note || open) return
    const measure = () => setClipped(note.scrollHeight > note.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(note)
    return () => observer.disconnect()
  }, [text, open])
  return <Box>
    <Typography ref={ref} id={id} variant="body2" sx={{ whiteSpace: 'pre-line', ...(open ? {} : clamp(2)) }}>
      <Box component="span" sx={{ fontWeight: 700 }}>{"Reviewer's note: "}</Box>{text}
    </Typography>
    {(clipped || open) && <Button size="small" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} sx={{ px: 0, minWidth: 0 }}>
      {open ? 'Show less' : 'Show more'}
    </Button>}
  </Box>
}
