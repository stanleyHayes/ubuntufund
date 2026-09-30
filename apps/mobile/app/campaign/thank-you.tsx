import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, ScrollView, StyleSheet, View, useWindowDimensions, type AppStateStatus } from 'react-native'
import { Dialog, Icon, Portal, Text } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DONOR_THANK_YOU_LIMITS, type DonorThankYouPreview, type DonorThankYouState, type DonorThankYouView } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { useNeu, usePalette } from '@/context/ColorModeContext'
import type { NeuRecipes, Palette } from '@/theme'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { Button, PageSkeleton } from '@/components/Loading'
import { EmptyState } from '@/components/EmptyState'
import { KeyboardAvoider } from '@/components/KeyboardAvoider'
import { ProgressBar } from '@/components/ProgressBar'
import { PublicationConsent } from '@/components/PublicationConsent'
import { PublicationHeldNotice } from '@/components/PublicationHeldNotice'
import { SignInRequired } from '@/components/SignInRequired'
import { confirmAction, confirmDestructive } from '@/lib/confirmDestructive'
import { isPublicationHeld } from '@/lib/publicationDrafts'
import {
  THANK_YOU_POLL_MS,
  THANK_YOU_STATUS_LABELS,
  canDraftThankYou,
  canRetryDeliveries,
  deliveryProgress,
  deliverySummary,
  donors,
  isDelivering,
  keepPollingAfter,
  sendAttempt,
  sendConfirmPrompt,
  sendOutcomeUnknown,
  shouldPoll,
  thankYouApi,
  thankYouBlockMessage,
  thankYouProblem,
  thankYouSignature,
  type SendAttempt,
} from '@/lib/donorThankYou'

type Styles = ReturnType<typeof makeStyles>
const EMPTY = thankYouSignature({ subject: '', body: '', signature: '' })
const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)
function formatDate(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

/** Post-campaign thank-you composer, mirroring the web: donors are emailed by Ujimora, the author sees counts only. */
export default function ThankDonorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const p = usePalette()
  return <View style={{ flex: 1, backgroundColor: p.background }}>
    <Stack.Screen options={{ title: 'Thank your donors' }} />
    {!user ? <SignInRequired what="thank-you messages" />
      : !id ? <EmptyState icon="email-fast-outline" title="Choose a campaign to thank its donors." style={{ margin: 16 }} />
      : <Composer key={`${user.id}:${id}`} campaignId={id} />}
  </View>
}

function Composer({ campaignId }: { campaignId: string }) {
  const p = usePalette()
  const neu = useNeu()
  const styles = useMemo(() => makeStyles(p, neu), [p, neu])
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const [state, setState] = useState<DonorThankYouState | null>(null)
  const [history, setHistory] = useState<DonorThankYouView[]>([])
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [signature, setSignature] = useState('')
  // The version the server holds as the draft; null when there is none.
  const [saved, setSaved] = useState<string | null>(null)
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [busy, setBusy] = useState<'' | 'save' | 'discard' | 'preview' | 'send' | 'retry'>('')
  const [retryingId, setRetryingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Held for safety review: a notice, not an error. The draft stays saved.
  const [held, setHeld] = useState(false)
  const [preview, setPreview] = useState<DonorThankYouPreview | null>(null)
  const [trackedId, setTrackedId] = useState<string | null>(null)
  const [pollError, setPollError] = useState('')
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  const attempt = useRef<SendAttempt | null>(null)
  const filled = useRef(false)

  useEffect(() => {
    let active = true
    thankYouApi.state(campaignId).then(next => {
      if (!active) return
      setState(next); setHistory(next.history); setLoadError('')
      // Fields come from the saved draft once; later reloads refresh eligibility and history only.
      if (!filled.current) {
        filled.current = true
        if (next.draft) {
          setSubject(next.draft.subject); setBody(next.draft.body); setSignature(next.draft.signature)
          setSaved(thankYouSignature(next.draft))
        }
      }
      setTrackedId(current => current ?? next.history.find(item => isDelivering(item.status))?.id ?? null)
    }).catch((e: unknown) => {
      if (!active) return
      setLoadError((e as { status?: number }).status === 404 ? 'You cannot send thank-you messages for this campaign.' : errorText(e, 'Could not load thank-you messages.'))
    })
    return () => { active = false }
  }, [campaignId, reload])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])

  // Progress while queued/sending, only in the foreground; stops on unmount, in the background and once final.
  const tracked = history.find(item => item.id === trackedId)
  const polling = shouldPoll(tracked, appState)
  useEffect(() => {
    if (!polling || !trackedId) return
    let active = true
    let inFlight = false
    const timer = setInterval(() => {
      if (inFlight) return
      inFlight = true
      thankYouApi.summary(campaignId, trackedId)
        .then(next => { if (active) { setHistory(items => items.map(item => (item.id === next.id ? next : item))); setPollError('') } })
        .catch((e: unknown) => {
          if (!active) return
          if (keepPollingAfter(e)) setPollError('Could not refresh delivery progress. Trying again…')
          else { setTrackedId(null); setPollError(errorText(e, 'Delivery progress is no longer available.')) }
        })
        .finally(() => { inFlight = false })
    }, THANK_YOU_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [campaignId, trackedId, polling])

  const content = { subject, body, signature }
  const version = thankYouSignature(content)
  const problem = thankYouProblem(content)
  const typed = version !== EMPTY
  const dirty = version !== (saved ?? EMPTY)
  const eligible = !!state?.eligible

  async function save() {
    setBusy('save'); setError(''); setNotice('')
    try {
      await thankYouApi.saveDraft(campaignId, content)
      if (!live.current) return
      setSaved(version); setNotice('Draft saved.')
    } catch (e) { if (live.current) setError(errorText(e, 'Could not save your draft.')) }
    finally { if (live.current) setBusy('') }
  }

  async function discard() {
    const confirmed = await confirmDestructive({ title: 'Discard this draft?', message: 'Your saved thank-you message will be deleted. This cannot be undone.', confirmLabel: 'Discard draft' })
    if (!confirmed || !live.current) return
    setBusy('discard'); setError(''); setNotice('')
    try {
      await thankYouApi.discardDraft(campaignId)
      if (!live.current) return
      attempt.current = null
      setSaved(null); setSubject(''); setBody(''); setSignature(''); setHeld(false); setNotice('Draft discarded.')
    } catch (e) { if (live.current) setError(errorText(e, 'Could not discard your draft.')) }
    finally { if (live.current) setBusy('') }
  }

  async function showPreview() {
    setBusy('preview'); setError('')
    try {
      const result = await thankYouApi.preview(campaignId, content)
      if (live.current) setPreview(result)
    } catch (e) { if (live.current) setError(errorText(e, 'Could not build the preview.')) }
    finally { if (live.current) setBusy('') }
  }

  async function send() {
    if (!state || !(await confirmAction(sendConfirmPrompt(state.estimatedRecipients))) || !live.current) return
    // A new key per tap; the same message after an unanswered tap keeps its key, so it cannot go out twice.
    attempt.current = sendAttempt(attempt.current, content)
    const { key } = attempt.current
    setBusy('send'); setError(''); setNotice(''); setHeld(false)
    try {
      // The API sends the saved draft, so save the latest text first.
      if (version !== saved) {
        await thankYouApi.saveDraft(campaignId, content)
        if (live.current) setSaved(version)
      }
      const view = await thankYouApi.send(campaignId, key, automatedReviewConsent)
      attempt.current = null
      if (!live.current) return
      setSaved(null); setSubject(''); setBody(''); setSignature('')
      setHistory(items => [view, ...items.filter(item => item.id !== view.id)])
      setTrackedId(view.id); setPollError('')
      setNotice('Your thank-you is on its way. Ujimora is emailing your donors.')
      setReload(value => value + 1)
    } catch (e) {
      const unknown = sendOutcomeUnknown(e)
      if (!unknown) attempt.current = null
      if (!live.current) return
      if (isPublicationHeld(e)) setHeld(true)
      else setError(unknown
        ? `${errorText(e, 'Could not send your message.')} Tap Send again to retry. Your donors will not get it twice.`
        : errorText(e, 'Could not send your message.'))
    } finally { if (live.current) setBusy('') }
  }

  async function retryFailed(item: DonorThankYouView) {
    setBusy('retry'); setRetryingId(item.id); setError(''); setNotice('')
    try {
      const { requeued } = await thankYouApi.retry(campaignId, item.id)
      if (!live.current) return
      // The API moves the message back to sending; polling picks up the outcome.
      setHistory(items => items.map(row => (row.id === item.id ? { ...row, status: 'sending' } : row)))
      setTrackedId(item.id); setPollError('')
      setNotice(`Trying again for ${donors(requeued)}.`)
    } catch (e) { if (live.current) setError(errorText(e, 'Could not retry the failed deliveries.')) }
    finally { if (live.current) { setBusy(''); setRetryingId('') } }
  }

  if (!state) {
    return loadError
      ? <View style={{ padding: 16 }}><EmptyState variant="error" icon="alert-circle-outline" title={loadError} ctaLabel="Try again" onCtaPress={() => { setLoadError(''); setReload(value => value + 1) }} /></View>
      : <PageSkeleton />
  }
  const draftable = canDraftThankYou(state)

  return <KeyboardAvoider style={{ backgroundColor: p.background }}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
      <View style={{ gap: 6 }}>
        <Text style={styles.title}>Thank everyone who gave</Text>
        <Text style={styles.muted}>Send one message to every donor of this campaign.</Text>
      </View>

      <View style={styles.banner}>
        <Icon source={eligible ? 'check-circle-outline' : 'information-outline'} size={20} color={p.primary} />
        <Text style={styles.bannerText}>{eligible
          ? state.trigger === 'payout_paid' ? 'A payout has been paid, so you can thank your donors now.' : 'The campaign has ended, so you can thank your donors now.'
          : thankYouBlockMessage(state.reason, state.sendsAllowed)}</Text>
      </View>

      {draftable && <View style={styles.card}>
        <Text variant="titleMedium" style={styles.heading}>Who receives it</Text>
        <Text style={styles.body}>{state.estimatedRecipients
          ? `About ${donors(state.estimatedRecipients)} will receive your message. The final count is set when it is sent.`
          : 'There are no donors to email yet.'}</Text>
        <Text style={styles.muted}>Donors are emailed by Ujimora. You will not see their names or email addresses. Each donor gets one copy, even if they gave more than once, and every email has an unsubscribe link.</Text>
        <Text style={styles.muted}>Thank-you messages sent: {state.sendsUsed} of {state.sendsAllowed}</Text>
      </View>}

      {draftable && <View style={styles.card}>
        <Text variant="titleMedium" style={styles.heading}>Your message</Text>
        <Text style={styles.muted}>Plain text only. Donors see your message, your signature and a short note from Ujimora with a link to the campaign.</Text>
        <TextInput label="Subject" placeholder="Thank you for standing with us" value={subject} onChangeText={setSubject} maxLength={DONOR_THANK_YOU_LIMITS.subject} disabled={!!busy} />
        <Text style={styles.counter}>{subject.length}/{DONOR_THANK_YOU_LIMITS.subject}</Text>
        <TextInput label="Message" placeholder="Tell donors what their support made possible" value={body} onChangeText={setBody} maxLength={DONOR_THANK_YOU_LIMITS.body} multiline disabled={!!busy} />
        <Text style={styles.counter}>{body.length}/{DONOR_THANK_YOU_LIMITS.body}</Text>
        <TextInput label="Signature (optional)" placeholder="For example: Ama and the clinic team" value={signature} onChangeText={setSignature} maxLength={DONOR_THANK_YOU_LIMITS.signature} disabled={!!busy} />
        <Text style={styles.counter}>{signature.length}/{DONOR_THANK_YOU_LIMITS.signature}</Text>
        <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
        {typed && problem ? <Text style={styles.muted}>{problem}</Text> : null}
        {typed && dirty && !problem ? <Text style={styles.muted}>Not saved yet. Sending saves it first.</Text> : null}
        {held && <PublicationHeldNotice retry="send the same message again" openSettings />}
        <View style={styles.actions}>
          <Button mode="outlined" icon="content-save-outline" loading={busy === 'save'} disabled={!!busy || !!problem || !dirty} onPress={() => void save()}>Save draft</Button>
          <Button mode="outlined" icon="eye-outline" loading={busy === 'preview'} disabled={!!busy || !!problem} onPress={() => void showPreview()}>Preview</Button>
          {saved !== null && <Button icon="delete-outline" textColor={p.error} loading={busy === 'discard'} disabled={!!busy} onPress={() => void discard()}>Discard</Button>}
        </View>
        <Button mode="contained" icon="send" loading={busy === 'send'} disabled={!!busy || !eligible || !!problem} onPress={() => void send()}>Send to donors</Button>
      </View>}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text> : null}

      {history.length > 0 && <View style={{ gap: 12 }}>
        <Text variant="titleMedium" style={styles.heading}>Sent messages</Text>
        {pollError ? <Text style={styles.muted}>{pollError}</Text> : null}
        {history.map(item => <SentMessage key={item.id} item={item} styles={styles} disabled={!!busy} retrying={retryingId === item.id} onRetry={() => void retryFailed(item)} />)}
      </View>}
    </ScrollView>

    <Portal>
      <Dialog visible={!!preview} onDismiss={() => setPreview(null)} style={{ maxHeight: height * 0.85 }}>
        <Dialog.Title>Preview</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 16 }}>
            <Text variant="bodySmall">This is exactly what your donors will receive.</Text>
            <Text variant="labelLarge">Subject</Text>
            <Text selectable style={{ fontFamily: 'Outfit_700Bold' }}>{preview?.subject}</Text>
            <Text selectable style={{ lineHeight: 21 }}>{preview?.text}</Text>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions><Button onPress={() => setPreview(null)}>Close</Button></Dialog.Actions>
      </Dialog>
    </Portal>
  </KeyboardAvoider>
}

function SentMessage({ item, styles, disabled, retrying, onRetry }: { item: DonorThankYouView; styles: Styles; disabled: boolean; retrying: boolean; onRetry: () => void }) {
  const p = usePalette()
  const tone = item.status === 'sent' ? p.success : item.status === 'failed' ? p.error : item.status === 'partially_sent' ? p.warningText : p.primary
  const date = formatDate(item.completedAt ?? item.submittedAt)
  const progress = deliveryProgress(item)
  return <View style={styles.card}>
    <View style={styles.itemHeader}>
      <View style={[styles.pill, { backgroundColor: `${tone}1F` }]}><Text style={[styles.pillText, { color: tone }]}>{THANK_YOU_STATUS_LABELS[item.status]}</Text></View>
      {date ? <Text style={styles.muted}>{date}</Text> : null}
    </View>
    <Text style={styles.itemSubject}>{item.subject}</Text>
    {isDelivering(item.status) && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}><ProgressBar progress={progress} height={6} /></View>}
    {deliverySummary(item).map(line => <Text key={line} style={styles.body}>{line}</Text>)}
    {canRetryDeliveries(item) && <Button mode="outlined" icon="refresh" loading={retrying} disabled={disabled} onPress={onRetry}>Retry failed deliveries</Button>}
  </View>
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    content: { padding: 16, gap: 16 },
    title: { fontSize: 26, lineHeight: 32, fontFamily: 'Outfit_800ExtraBold', color: p.text },
    heading: { fontFamily: 'Outfit_700Bold', color: p.text },
    body: { color: p.text, lineHeight: 20 },
    muted: { color: p.textSecondary, lineHeight: 20 },
    card: { ...neu.raised, backgroundColor: p.surface, borderRadius: 20, padding: 16, gap: 12 },
    banner: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, backgroundColor: `${p.primary}0F` },
    bannerText: { flex: 1, color: p.text, lineHeight: 20 },
    counter: { alignSelf: 'flex-end', fontSize: 12, color: p.textSecondary, marginTop: -6 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    error: { color: p.error, lineHeight: 20 },
    success: { color: p.success, lineHeight: 20 },
    itemHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    pillText: { fontSize: 12, fontFamily: 'Outfit_700Bold' },
    itemSubject: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text },
  })
}
