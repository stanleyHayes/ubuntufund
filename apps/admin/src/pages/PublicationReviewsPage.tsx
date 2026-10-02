import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import PageHeader from '@/components/PageHeader'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import ExportMenu from '@/components/ExportMenu'
import PublicationReviewCard, { type DecisionError } from '@/components/publication/PublicationReviewCard'
import { Isolated } from '@/components/publication/ReviewParts'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable } from '@/lib/exports/report'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, MenuItem, Skeleton, Stack, Typography } from '@mui/material'
import { Action, Resource } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/apiError'
import { useAuth } from '@/context/AuthContext'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { parseSubmission, type PublicationReviewItem, type ReviewQueue } from '@/lib/publicationReview'
import { publicationReviewColumns } from '@/lib/exports/publicationReviews'
import { autoPublishingIn, decisionConfirmation, decisionResultOf, guidanceFor, pageIntro, type DecisionConfirmation } from '@/lib/reviewGuidance'

type Kind = 'publication-reviews' | 'tip-content-reviews' | 'donation-content-reviews'

/** The status filter, worded like the status chips on the cards. */
const STATUSES = [['pending', 'Waiting for review'], ['approved', 'Approved'], ['rejected', 'Declined']] as const

/**
 * Review notes by item id, then by content version. Tip and donation content
 * can change under the same id (a donor edits their message, say), so notes
 * written about one version never fill in, or approve, the next. Publication
 * items have one version per record and use ''.
 */
type Notes = Record<string, Record<string, string>>
const versionOf = (item: PublicationReviewItem) => item.version ?? ''

/** Notes were typed for an earlier version of this item's content. */
function hasEarlierNotes(notes: Notes, item: PublicationReviewItem): boolean {
  return Object.entries(notes[item.id] ?? {}).some(([version, text]) => version !== versionOf(item) && text.trim().length > 0)
}

/** Where keyboard focus goes once the next load finishes: back to the toolbar's Refresh button, or to a card's title. */
type FocusTarget = { refresh: true } | { itemId?: string }

/** Focus the title of the card for `itemId`, or else of the first card. False when the queue shows no cards. */
function focusCardTitle(root: HTMLElement | null, itemId?: string): boolean {
  const cards = Array.from(root?.querySelectorAll<HTMLElement>('article[data-review-id]') ?? [])
  const title = (cards.find(card => card.dataset.reviewId === itemId) ?? cards[0])?.querySelector<HTMLElement>('h2')
  title?.focus()
  return !!title
}

export default function PublicationReviewsPage() {
  const { user } = useAuth()
  const { can } = useAdminPermissions()
  // Plain booleans for the cards, so they need no permission provider.
  const links = { users: can(Resource.USERS, Action.READ), campaigns: can(Resource.CAMPAIGNS, Action.READ), audit: can(Resource.AUDIT_LOG, Action.READ) }
  const [kind, setKind] = useState<Kind>(() => { const queue = new URLSearchParams(window.location.search).get('queue'); return queue === 'tip-content-reviews' || queue === 'donation-content-reviews' ? queue : 'publication-reviews' })
  const queue: ReviewQueue = kind === 'publication-reviews' ? 'publication' : 'content'
  const endpoint = `/admin/${kind}`
  const revision = useRef(0)
  const [items, setItems] = useState<PublicationReviewItem[]>([]), [status, setStatus] = useState('pending'), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [notes, setNotes] = useState<Notes>({}), [busy, setBusy] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState(12)
  // When the list loaded: cards describe dates relative to it, so nothing reads the clock while rendering.
  const [loadedAt, setLoadedAt] = useState(0)
  const [campaignReviewGoal, setCampaignReviewGoal] = useState<number | undefined>(undefined)
  // Publishing on approval is on: the last list that could tell had a version that publishes by itself. Kept while the next one loads.
  const [autoPublishing, setAutoPublishing] = useState(false)
  // A failed decision belongs to its card; the page-level error is only for a failed load.
  const [decisionError, setDecisionError] = useState<DecisionError | null>(null)
  const [confirmation, setConfirmation] = useState<DecisionConfirmation | null>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const refreshRef = useRef<HTMLButtonElement>(null)
  const focusAfterLoad = useRef<FocusTarget | null>(null)
  const load = useCallback(async () => {
    const current = ++revision.current
    setLoading(true)
    setItems([])
    try {
      const data = await api.get<{ items: PublicationReviewItem[]; total: number; campaignReviewGoalGhs?: number }>(`${endpoint}?status=${status}&page=${page}&pageSize=${pageSize}`)
      if (current !== revision.current) return
      const list = Array.isArray(data.items) ? data.items : []
      setItems(list)
      const shown = autoPublishingIn(list)
      if (shown !== null) setAutoPublishing(shown)
      setTotal(data.total)
      setCampaignReviewGoal(typeof data.campaignReviewGoalGhs === 'number' ? data.campaignReviewGoalGhs : undefined)
      setLoadedAt(Date.now())
      setDecisionError(null)
      setError('')
    }
    catch { if (current !== revision.current) return; setItems([]); setError('Could not load publication reviews. Please retry.') }
    finally { if (current === revision.current) setLoading(false) }
  }, [pageSize, page, status, endpoint])
  // A decision outlives the render that started it: reload the queue as it is filtered now, not as it was then.
  const latestLoad = useRef(load)
  useEffect(() => { latestLoad.current = load }, [load])
  useEffect(() => {
    void load()
    // Invalidate this load if the filters change or the page closes first.
    const loads = revision
    return () => { loads.current++ }
  }, [load])
  // After a decision the card disappears; keep keyboard focus on the confirmation instead of the page body.
  useEffect(() => { if (confirmation) confirmationRef.current?.focus() }, [confirmation])
  // A reload replaces every card, which drops keyboard focus on the page body: put it back where the reviewer was.
  useEffect(() => {
    const target = focusAfterLoad.current
    if (loading || !target) return
    focusAfterLoad.current = null
    if ('refresh' in target || !focusCardTitle(rootRef.current, target.itemId)) refreshRef.current?.focus()
  }, [loading])
  function reload(target: FocusTarget) {
    focusAfterLoad.current = target
    void load()
  }
  function closeConfirmation() {
    // Move focus before the focused alert goes away.
    if (loading) focusAfterLoad.current = {}
    else if (!focusCardTitle(rootRef.current)) refreshRef.current?.focus()
    setConfirmation(null)
  }
  async function decide(item: PublicationReviewItem, decision: 'approved' | 'rejected') {
    setBusy(item.id)
    setConfirmation(null)
    setDecisionError(null)
    const decidedAt = Date.now()
    let response: unknown
    try { response = await api.put<unknown>(`${endpoint}/${item.id}/review`, { decision, notes: notes[item.id]?.[versionOf(item)], ...(item.version ? { version: item.version } : {}) }) }
    catch (e) {
      setDecisionError({ id: item.id, message: e instanceof Error && e.message ? e.message : 'Could not save review', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.errors?.review?.[0] : undefined })
      setBusy('')
      return
    }
    let message: DecisionConfirmation = { severity: 'success', message: [decision === 'approved' ? 'Approved.' : 'Declined.'] }
    try {
      // The answer says whether this approval published by itself (publishing on approval may have been switched since the list loaded).
      const result = queue === 'publication' ? decisionResultOf(response) : null
      const decided = result ? { ...item, publishOnApproval: result.publishOnApproval } : item
      const guidance = guidanceFor(decided, parseSubmission(item.action, item.text, item.mediaUrls), { queue, now: decidedAt, campaignReviewGoalGhs: campaignReviewGoal })
      message = decisionConfirmation(decided, decision, result, guidance)
    } catch { /* The decision is saved; keep the short confirmation. */ }
    setConfirmation(message)
    try { await latestLoad.current() } finally { setBusy('') }
  }
  return <Stack ref={rootRef} spacing={3}>
    <PageHeader title="Publication reviews" eyebrow="Trust & safety" lede="Review proposed public content and keep each decision tied to its author and version." icon={<FactCheckRoundedIcon />} stats={[{ label: "Submissions in this view", value: loading ? <Skeleton width={60} /> : error ? "—" : total }]} />
    <ReviewQueueToolbar>
      <TextField optionContext="publication" select sx={{ maxWidth: { sm: 420 } }} label="Content queue" value={kind} disabled={!!busy} onChange={event => { setKind(event.target.value as Kind); setPage(1); setNotes({}); setConfirmation(null); setDecisionError(null) }}><MenuItem value="publication-reviews">Publication proposals</MenuItem><MenuItem value="tip-content-reviews">Supporter names and messages</MenuItem><MenuItem value="donation-content-reviews">Campaign donor names and messages</MenuItem></TextField>
      <TextField optionContext="publication" select sx={{ maxWidth: { sm: 280 } }} label="Review status" value={status} disabled={!!busy} onChange={e => { setStatus(e.target.value); setPage(1); setConfirmation(null) }}>{STATUSES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <Button ref={refreshRef} variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => reload({ refresh: true })}>Refresh publication reviews</Button>
      <ExportMenu title="Publication reviews" disabled={loading || !!error} getReport={async progress => ({ title: "Publication reviews", filters: [`Queue: ${kind}`, `Status: ${status}`], tables: [exportTable("Publication reviews", await loadAll<PublicationReviewItem>(`${endpoint}?status=${status}`, progress), publicationReviewColumns(queue, Date.now()))] })} />
    </ReviewQueueToolbar>

    <Typography>{pageIntro(queue, autoPublishing)}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {confirmation && <Alert ref={confirmationRef} severity={confirmation.severity} role="status" tabIndex={-1} onClose={closeConfirmation}>
      {/* A quoted campaign title is the author's text: isolate it from the sentence around it. */}
      {confirmation.message.map((part, index) => (typeof part === 'string' ? part : <Isolated key={index}>{part.value}</Isolated>))}
    </Alert>}

    {loading ? <ReviewQueueSkeleton label="Loading publication reviews" /> : items.map(item => <PublicationReviewCard
      key={item.id}
      item={item}
      queue={queue}
      now={loadedAt}
      currentUserId={user?.id}
      links={links}
      notes={notes[item.id]?.[versionOf(item)] ?? ''}
      onNotesChange={value => setNotes(current => ({ ...current, [item.id]: { ...current[item.id], [versionOf(item)]: value } }))}
      earlierVersionNotes={hasEarlierNotes(notes, item)}
      busy={busy}
      error={decisionError?.id === item.id ? decisionError : null}
      onDecide={decision => void decide(item, decision)}
      onRefresh={() => reload({ itemId: item.id })}
      campaignReviewGoalGhs={campaignReviewGoal}
      autoPublishing={autoPublishing}
    />)}
    {!loading && !items.length && !error && <ReviewQueueEmpty title="No submissions in this queue." description="New proposals appear here when they need review. Choose another queue or status to see earlier decisions." icon={<FactCheckRoundedIcon />} />}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
  </Stack>
}
