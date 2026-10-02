import { useCallback, useMemo, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import {
  describePublicationReview,
  parsePublicationReviewPage,
  type PublicationAction,
  type PublicationReviewItem,
  type PublicationReviewStage,
  type PublicationStepState,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { confirmDestructive, type DestructivePrompt } from '@/lib/confirmDestructive'
import { clearIdentityDraft } from '@/lib/publicationDrafts'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'
import { Button } from '@/components/Loading'
import { GlassSurface } from '@/components/GlassSurface'

/** The list API's default page. */
const PAGE_SIZE = 25
/**
 * The list API has no action filter, so a screen's own kinds of change are
 * picked here from the author's latest submissions (the API's largest page).
 * Older ones stay reachable in Settings, which lists every kind page by page.
 */
const FILTERED_PAGE_SIZE = 100

/** `skipped` (replaced or withdrawn) stopped unpublished: neutral, neither done nor failed. */
const STEP_ICON: Record<PublicationStepState, string> = { complete: 'check-circle', current: 'radiobox-marked', upcoming: 'circle-outline', failed: 'close-circle', skipped: 'minus-circle' }
const stepTone = (state: PublicationStepState, p: Palette) => ({ complete: p.success, current: p.primary, upcoming: p.textSecondary, failed: p.error, skipped: p.textSecondary })[state]
const lineTone = (state: PublicationStepState, p: Palette) => state === 'upcoming' || state === 'skipped' ? `${p.textSecondary}40` : stepTone(state, p)
const labelTone = (state: PublicationStepState, p: Palette) => ({ complete: p.text, current: p.text, upcoming: p.textSecondary, failed: p.error, skipped: p.textSecondary })[state]

const WITHDRAW_PROMPT: DestructivePrompt = {
  title: 'Withdraw this version?',
  message: "It won't be published. You can submit it again later for a new review.",
  confirmLabel: 'Withdraw',
}

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
const announce = (message: string) => AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true })

type Styles = ReturnType<typeof makeStyles>

/**
 * The author's own publication reviews as compact status cards: the kind of
 * change and its subject, a Submitted → In review → Approved (or Declined)
 * tracker, with Published after it when the approval publishes the version
 * by itself, the reviewer's note and what to do next. Never the submitted
 * content itself. A version that is not published yet can be withdrawn.
 * `actions` narrows the list to one screen's own kinds of change; without it
 * (Settings) every kind is listed.
 */
export function PublicationReviews({ actions }: { actions?: readonly PublicationAction[] }) {
  const { user } = useAuth()
  return <ViewerReviews key={user?.id ?? 'guest'} userId={user?.id} actions={actions} />
}
function ViewerReviews({ userId, actions }: { userId?: string; actions?: readonly PublicationAction[] }) {
  const p = usePalette()
  const styles = useMemo(() => makeStyles(p), [p])
  // A string, so an inline `actions` array does not reload the list on every render.
  const only = actions?.length ? actions.join(' ') : ''
  const [items, setItems] = useState<PublicationReviewItem[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [older, setOlder] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  // Why withdrawing a version did not work, on its card until the next Refresh, and the version being withdrawn.
  const [refusals, setRefusals] = useState<Readonly<Record<string, string>>>({}), [withdrawing, setWithdrawing] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = parsePublicationReviewPage(await api.get<unknown>(only ? `/publication-reviews?page=1&pageSize=${FILTERED_PAGE_SIZE}` : `/publication-reviews?page=${page}`))
      if (!data) throw new Error('Invalid review response')
      const kinds = new Set(only.split(' '))
      setItems(only ? data.items.filter(item => kinds.has(item.action)) : data.items); setTotal(data.total)
      setOlder(!!only && data.total > data.items.length); setError('')
    }
    catch { setItems([]); setOlder(false); setError('Could not load your publication reviews. Tap Refresh to try again.') }
    finally { setLoading(false) }
  }, [page, only])
  useFocusEffect(useCallback(() => { void load() }, [load]))
  async function withdraw(item: PublicationReviewItem) {
    if (withdrawing || !(await confirmDestructive(WITHDRAW_PROMPT))) return
    const { id } = item
    setWithdrawing(id); setRefusals(({ [id]: _previous, ...rest }) => rest)
    // Settled: '' once withdrawn, or why it was refused. A refusal means the version moved on meanwhile (published, replaced or declined).
    const refusal = await api.post(`/publication-reviews/${encodeURIComponent(id)}/withdraw`).then(
      () => '',
      (err: unknown) => (statusOf(err) === 409 ? (err instanceof Error && err.message) || "This version can't be withdrawn now." : null),
    )
    // This device keeps a held profile change to submit again; a withdrawn one must not come back with the form.
    if (refusal === '' && item.action === 'account.profile' && userId) await clearIdentityDraft(userId)
    setWithdrawing('')
    // Anything else may never have reached the API: the card keeps its Withdraw to try again. Said out loud too:
    // a new alert's text is not announced by VoiceOver, nor by TalkBack when it arrives with it (see PublicationHeldNotice).
    if (refusal === null) {
      const failed = 'Could not withdraw it. Check your connection and try again.'
      setRefusals(current => ({ ...current, [id]: failed }))
      announce(failed)
      return
    }
    if (refusal) setRefusals(current => ({ ...current, [id]: refusal }))
    announce(refusal || "Withdrawn. It won't be published.")
    // The card shows where the version stands now.
    void load()
  }
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <View style={styles.header}>
      <Text variant="titleMedium" accessibilityRole="header" style={styles.heading}>Publication reviews</Text>
      <Button compact icon="refresh" disabled={loading} accessibilityLabel="Refresh publication reviews" onPress={() => { setRefusals({}); void load() }}>Refresh</Button>
    </View>
    {/* With publishing on approval on, approval publishes most changes by itself; otherwise (switched off, live sessions, versions held before it) they go public once their author submits them again. */}
    <Text style={styles.muted}>{items.some(publishesItself) ? "Held changes stay private until they're approved." : 'Held changes stay private until they are published.'}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {/* A reload keeps the cards in place, so the one a screen reader is on never disappears while it refreshes. */}
    {loading && !items.length ? <Text style={styles.muted}>Loading reviews…</Text> : items.map(item => <ReviewCard key={item.id} review={item} styles={styles} p={p}
      refusal={refusals[item.id]} withdrawing={withdrawing === item.id} locked={!!withdrawing} onWithdraw={item.canWithdraw === true ? () => void withdraw(item) : undefined} />)}
    {!loading && !items.length && !error && <Text style={styles.muted}>Nothing waiting for review.</Text>}
    {older && <View style={{ gap: 4 }}>
      <Text style={styles.muted}>Only your latest submissions are listed here.</Text>
      <Button compact style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/settings')}>See all in Settings</Button>
    </View>}
    {/* Kept past page 1, so a list that shrank meanwhile never strands the author on an empty page. */}
    {!only && (total > PAGE_SIZE || page > 1) && <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button disabled={loading || page === 1} onPress={() => setPage(page - 1)}>Previous</Button>
      <Button disabled={loading || page * PAGE_SIZE >= total} onPress={() => setPage(page + 1)}>Next</Button>
    </View>}
  </View>
}

function ReviewCard({ review, refusal, withdrawing, locked, onWithdraw, styles, p }: {
  /** `withdrawing`: this version is being withdrawn; `locked`: one is, so every Withdraw waits. */
  review: PublicationReviewItem; refusal?: string; withdrawing: boolean; locked: boolean; onWithdraw?: () => void; styles: Styles; p: Palette
}) {
  const described = describePublicationReview(review)
  const { label, subject, note, stage } = described
  return <GlassSurface variant="subtle" style={styles.card}>
    <Text numberOfLines={1} style={styles.title}>{label}{subject ? <Text style={styles.subject}>{` · ${subject}`}</Text> : null}</Text>
    <ReviewSteps stage={stage} styles={styles} p={p} />
    {note ? <ReviewNote text={note} styles={styles} /> : null}
    {stage.hint ? <Text style={styles.body}>{stage.hint}</Text> : null}
    {stage.support ? <Text selectable style={styles.caption}>{stage.support}</Text> : null}
    {refusal ? <Text accessibilityRole="alert" style={styles.refusal}>{refusal}</Text> : null}
    {onWithdraw ? <Button compact mode="outlined" icon="undo-variant" loading={withdrawing} disabled={locked} style={{ alignSelf: 'flex-start' }}
      accessibilityLabel={`Withdraw ${titleOf(described)}`} onPress={onWithdraw}>Withdraw</Button> : null}
  </GlassSurface>
}

/** Labels sit under their icons, so the steps share the width and read at phone size. */
function ReviewSteps({ stage, styles, p }: { stage: PublicationReviewStage; styles: Styles; p: Palette }) {
  const submitted = stage.steps.find(step => step.key === 'submitted')?.detail
  const published = stage.steps.find(step => step.key === 'publish' && step.state === 'complete')?.detail
  // An approval that ran out before its version was published (the phase says so when that is all there is to say).
  const lapsed = stage.phase !== 'approval_expired' && stage.steps.some(step => step.key === 'decision' && step.detail === 'Expired')
  const summary = [`Review status: ${stage.label}`, submitted && `Submitted ${submitted}`, lapsed && 'Approval expired', published && `Published ${published}`].filter(Boolean).join('. ')
  return <View accessible accessibilityLabel={summary} style={styles.steps}>
    {stage.steps.map((step, index) => {
      const next = stage.steps[index + 1]
      return <View key={step.key} style={styles.step}>
        <View style={styles.track}>
          <View style={[styles.line, { backgroundColor: index ? lineTone(step.state, p) : 'transparent' }]} />
          <Icon source={STEP_ICON[step.state]} size={22} color={stepTone(step.state, p)} />
          <View style={[styles.line, { backgroundColor: next ? lineTone(next.state, p) : 'transparent' }]} />
        </View>
        <Text style={[styles.stepLabel, { color: labelTone(step.state, p), fontFamily: step.state === 'upcoming' ? 'Outfit_400Regular' : 'Outfit_700Bold' }]}>{step.label}</Text>
        {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
      </View>
    })}
  </View>
}

/** The reviewer's note, two lines until the author asks for the rest. */
function ReviewNote({ text, styles }: { text: string; styles: Styles }) {
  const [open, setOpen] = useState(false), [clipped, setClipped] = useState(false)
  const content = <><Text style={styles.noteLabel}>{"Reviewer's note: "}</Text>{text}</>
  return <View>
    <Text numberOfLines={open ? undefined : 2} style={styles.body}>{content}</Text>
    {/* Laid out in full but never shown, so Show more appears only when two lines cut the note off, at any width or text size. */}
    <View pointerEvents="none" style={styles.measure}>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onTextLayout={event => setClipped(event.nativeEvent.lines.length > 2)} style={styles.body}>{content}</Text>
    </View>
    {(clipped || open) && <Button compact style={{ alignSelf: 'flex-start' }} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}>{open ? 'Show less' : 'Show more'}</Button>}
  </View>
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    heading: { fontFamily: 'Outfit_700Bold', color: p.text },
    body: { fontFamily: 'Outfit_400Regular', color: p.text, lineHeight: 20 },
    muted: { fontFamily: 'Outfit_400Regular', color: p.textSecondary, lineHeight: 20 },
    caption: { fontFamily: 'Outfit_400Regular', color: p.textSecondary, fontSize: 12, lineHeight: 16 },
    error: { fontFamily: 'Outfit_400Regular', color: p.error, lineHeight: 20 },
    // A refused withdrawal is not a failure: the version moved on (published, replaced or declined).
    refusal: { fontFamily: 'Outfit_400Regular', color: p.warningText, lineHeight: 20 },
    card: { padding: 14, borderRadius: 16, gap: 10 },
    title: { fontFamily: 'Outfit_700Bold', color: p.text, fontSize: 15 },
    subject: { fontFamily: 'Outfit_400Regular', color: p.textSecondary },
    steps: { flexDirection: 'row' },
    step: { flex: 1, minWidth: 0, alignItems: 'center' },
    track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 4 },
    // Two halves meet at each column edge, so their ends stay square.
    line: { flex: 1, height: 2 },
    stepLabel: { marginTop: 4, fontSize: 12, lineHeight: 16, textAlign: 'center' },
    stepDetail: { fontFamily: 'Outfit_400Regular', color: p.textSecondary, fontSize: 11, lineHeight: 14, textAlign: 'center' },
    noteLabel: { fontFamily: 'Outfit_700Bold', color: p.text },
    measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  })
}
