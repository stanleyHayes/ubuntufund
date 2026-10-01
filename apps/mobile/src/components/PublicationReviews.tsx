import { useCallback, useMemo, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { StyleSheet, View } from 'react-native'
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

const STEP_ICON: Record<PublicationStepState, string> = { complete: 'check-circle', current: 'radiobox-marked', upcoming: 'circle-outline', failed: 'close-circle' }
const stepTone = (state: PublicationStepState, p: Palette) => ({ complete: p.success, current: p.primary, upcoming: p.textSecondary, failed: p.error })[state]
const lineTone = (state: PublicationStepState, p: Palette) => state === 'upcoming' ? `${p.textSecondary}40` : stepTone(state, p)
const labelTone = (state: PublicationStepState, p: Palette) => ({ complete: p.text, current: p.text, upcoming: p.textSecondary, failed: p.error })[state]

type Styles = ReturnType<typeof makeStyles>

/**
 * The author's own publication reviews as compact status cards: the kind of
 * change and its subject, a Submitted → In review → Approved (or Declined)
 * tracker, the reviewer's note and what to do next. Never the submitted
 * content itself. `actions` narrows the list to one screen's own kinds of
 * change; without it (Settings) every kind is listed.
 */
export function PublicationReviews({ actions }: { actions?: readonly PublicationAction[] }) {
  const { user } = useAuth()
  return <ViewerReviews key={user?.id ?? 'guest'} actions={actions} />
}
function ViewerReviews({ actions }: { actions?: readonly PublicationAction[] }) {
  const p = usePalette()
  const styles = useMemo(() => makeStyles(p), [p])
  // A string, so an inline `actions` array does not reload the list on every render.
  const only = actions?.length ? actions.join(' ') : ''
  const [items, setItems] = useState<PublicationReviewItem[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [older, setOlder] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true)
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
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <View style={styles.header}>
      <Text variant="titleMedium" accessibilityRole="header" style={styles.heading}>Publication reviews</Text>
      <Button compact icon="refresh" disabled={loading} accessibilityLabel="Refresh publication reviews" onPress={() => void load()}>Refresh</Button>
    </View>
    <Text style={styles.muted}>Held changes stay private until they are published.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {loading ? <Text style={styles.muted}>Loading reviews…</Text> : items.map(item => <ReviewCard key={item.id} review={item} styles={styles} p={p} />)}
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

function ReviewCard({ review, styles, p }: { review: PublicationReviewItem; styles: Styles; p: Palette }) {
  const { label, subject, note, stage } = describePublicationReview(review)
  return <GlassSurface variant="subtle" style={styles.card}>
    <Text numberOfLines={1} style={styles.title}>{label}{subject ? <Text style={styles.subject}>{` · ${subject}`}</Text> : null}</Text>
    <ReviewSteps stage={stage} styles={styles} p={p} />
    {note ? <ReviewNote text={note} styles={styles} /> : null}
    {stage.hint ? <Text style={styles.body}>{stage.hint}</Text> : null}
    {stage.support ? <Text selectable style={styles.caption}>{stage.support}</Text> : null}
  </GlassSurface>
}

/** Labels sit under their icons, so the steps share the width and read at phone size. */
function ReviewSteps({ stage, styles, p }: { stage: PublicationReviewStage; styles: Styles; p: Palette }) {
  const submitted = stage.steps.find(step => step.key === 'submitted')?.detail
  const summary = [`Review status: ${stage.label}`, submitted && `Submitted ${submitted}`].filter(Boolean).join('. ')
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
