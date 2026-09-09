import { useEffect, useState } from 'react'
import { ScrollView, View, AppState, Share } from 'react-native'
import { Text } from 'react-native-paper'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import type { LiveSessionPublicView } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { LiveVideo } from '@/components/LiveVideo'
import { Button, PageSkeleton } from '@/components/Loading'
import { usePalette, useNeu } from '@/context/ColorModeContext'

export default function WatchLive() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const p = usePalette(); const neu = useNeu()
  const [session, setSession] = useState<LiveSessionPublicView | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() { try { const result = await api.get<LiveSessionPublicView>(`/live-sessions/${sessionId}/public`); if (active) { setSession(result); setError('') } } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load broadcast.') } }
    void load(); const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [sessionId])
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, gap: 20 }}><Stack.Screen options={{ title: 'Live on Ujimora' }} />
    {error ? <Text style={{ color: p.error }}>{error}</Text> : null}
    {!session && !error && <PageSkeleton />}
    {session && <><Text variant="headlineMedium">{session.title || 'Live on Ujimora'}</Text>
      {session.status === 'active' ? <LiveVideo sessionId={session.id} /> : <Text>This broadcast has ended. You can still support the campaign.</Text>}
      <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 12 }}><Text>Together, during this broadcast</Text>{session.amountRaised !== null && <Text variant="headlineMedium">{session.currency || 'GHS'} {session.amountRaised.toLocaleString()}</Text>}<Text>{session.successfulDonations} donations</Text></View>
      <Button mode="contained" onPress={() => router.push({ pathname: '/donate/[id]', params: { id: session.campaignId, ...(session.status === 'active' ? { liveSessionId: session.id } : {}) } })}>Support this campaign</Button>
      <Button onPress={() => router.push(`/campaign/${session.campaignId}`)}>View campaign</Button>
      <Button icon="share-variant" onPress={() => void Share.share({ message: `https://app.ujimora.com/live/${session.id}` })}>Share broadcast</Button>
    </>}
  </ScrollView>
}
