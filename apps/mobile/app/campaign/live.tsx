import { QrManager } from '@/components/CampaignManagement'
import { useEffect, useState, useRef } from 'react'
import { View, ScrollView, AppState, Share, Alert } from 'react-native'
import { Text, Switch } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import type { LiveSession } from '@ubuntu-fund/types'
import { api, API_BASE } from '@/lib/api'
import * as Clipboard from 'expo-clipboard'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { useAuth } from '@/context/AuthContext'
import { LiveVideo } from '@/components/LiveVideo'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { Button, PageSkeleton } from '@/components/Loading'
import { SignInRequired } from '@/components/SignInRequired'

export default function BroadcastStudio() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth(); const p = usePalette(); const neu = useNeu()
  const generation = useRef(0)
  const mutating = useRef(false)
  const [session, setSession] = useState<LiveSession | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [overlayCopied, setOverlayCopied] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!user || !id) return
    let active = true
    async function load() {
      if (mutating.current) return
      const ticket = ++generation.current
      try { const [config, found] = await Promise.all([api.get<{ enabled: boolean }>('/live-sessions/video/config'), api.get<LiveSession | null>(`/campaigns/${id}/live-sessions/active`)]); if (active && ticket === generation.current) { setEnabled(config.enabled); setSession(found); setError('') } }
      catch (e) { if (active && ticket === generation.current) setError(e instanceof Error ? e.message : 'Could not load studio.') }
      finally { if (active && ticket === generation.current) setLoading(false) }
    }
    void load(); const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [id, user, retry])
  async function start() {
    if (mutating.current) return
    mutating.current = true; generation.current += 1
    setBusy(true); setError('')
    try { setSession(await api.post<LiveSession>(`/campaigns/${id}/live-sessions`, { title: title.trim() || undefined, targetAmount: target ? Number(target) : undefined })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start broadcast.') } finally { mutating.current = false; setBusy(false) }
  }
  async function update(input: Record<string, unknown>) {
    if (!session) return
    if (mutating.current) return
    mutating.current = true; generation.current += 1
    setBusy(true); setError('')
    try { const updated = await api.patch<LiveSession>(`/live-sessions/${session.id}`, input); setSession(updated.status === 'ended' ? null : updated) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update broadcast.') } finally { mutating.current = false; setBusy(false) }
  }
  async function rotateOverlay() {
    if (!session || mutating.current) return
    mutating.current = true; generation.current += 1; setBusy(true); setError('')
    try { setSession(await api.post<LiveSession>(`/live-sessions/${session.id}/overlay-token/rotate`, {})); setOverlayCopied(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not rotate overlay link.') }
    finally { mutating.current = false; setBusy(false) }
  }
  if (!user) return <SignInRequired what="broadcast studio" />
  if (!id) return <Text>Select a campaign to broadcast.</Text>
  if (loading) return <PageSkeleton />
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}><Stack.Screen options={{ title: 'Broadcast studio' }} />
    <Text style={{ fontSize: 28, fontFamily: 'Outfit_800ExtraBold', color: p.text }}>Go live with your community</Text>
    {error ? <View><Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text><Button onPress={() => setRetry(n => n + 1)}>Reload studio</Button></View> : null}
    {session ? <>
      <LiveVideo key={session.id} sessionId={session.id} host />
      <QrManager campaignId={id} liveSessionId={session.id} />
      <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 12 }}>
        <Text variant="titleLarge">OBS overlay</Text><Text>Copy this private link into an OBS Browser Source. Anyone with the link can view the overlay. Rotating it invalidates the previous link.</Text>
        <Button disabled={busy} onPress={() => void Clipboard.setStringAsync(`${API_BASE}/live-sessions/${session.id}/overlay/view?token=${encodeURIComponent(session.overlayToken)}`).then(() => setOverlayCopied(true))}>{overlayCopied ? 'Overlay link copied' : 'Copy private overlay link'}</Button>
        <Button disabled={busy} onPress={() => Alert.alert('Replace overlay link?', 'The old OBS link will stop working. Copy the new link into OBS after replacing it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace link', onPress: () => void rotateOverlay() }])}>Replace overlay link</Button>
      </View>
      <View style={{ ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 20, gap: 12 }}>
        <Text variant="titleLarge">{session.title || 'Your broadcast'}</Text><Text>GH₵{session.stats.amountRaised.toLocaleString()} · {session.stats.successfulDonations} donations</Text>
        <Button icon="share-variant" onPress={() => void Share.share({ message: `Watch ${session.title || 'my campaign'} live on Ujimora: https://app.ujimora.com/live/${session.id}` })}>Share viewer link</Button>
        {(['showDonorNames', 'showDonorMessages', 'showAmounts', 'privacyMode'] as const).map(key => <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ flex: 1 }}>{({ showDonorNames: 'Show donor names', showDonorMessages: 'Show messages', showAmounts: 'Show amounts', privacyMode: 'Privacy mode' })[key]}</Text><Switch disabled={busy} value={session[key]} onValueChange={value => void update({ [key]: value })} /></View>)}
        <Text>Disconnecting your camera leaves the session open so you can reconnect. End broadcast closes it for everyone.</Text>
        <Button mode="contained" disabled={busy} loading={busy} onPress={() => Alert.alert('End broadcast?', 'This closes the live session for viewers.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End broadcast', style: 'destructive', onPress: () => void update({ status: 'ended' }) }])}>End broadcast</Button>
      </View>
    </> : <View style={{ ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 20, gap: 16 }}>
      <TextInput label="Broadcast title" value={title} onChangeText={setTitle} maxLength={200} /><TextInput label="Session goal (GHS, optional)" keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
      <Text>Start a session, then connect your camera and microphone. Your campaign must be active and your plan must include live streaming.</Text>
      {!enabled && <Text>Live broadcasting is not configured yet.</Text>}
      <Button mode="contained" loading={busy} disabled={busy || !enabled || !!error || (!!target && (!Number.isFinite(Number(target)) || Number(target) <= 0))} onPress={() => void start()}>Create live session</Button>
    </View>}
  </ScrollView>
}
