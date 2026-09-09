import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '@/lib/api'
import { PageSkeleton } from '@/components/Loading'
import { usePalette } from '@/context/ColorModeContext'
export default function SharedCampaign() {
  const { slug, donate, amount } = useLocalSearchParams<{ slug: string; donate?: string; amount?: string }>()
  const router = useRouter(); const p = usePalette()
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    api.get<{ id: string }>(`/campaigns/slug/${encodeURIComponent(slug ?? '')}/public`).then(campaign => {
      if (active) router.replace(donate === '1' ? `/donate/${campaign.id}${amount ? '?amount=' + encodeURIComponent(amount) : ''}` : `/campaign/${campaign.id}`)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not open campaign.') })
    return () => { active = false }
  }, [slug, donate, amount, router, attempt])
  return <View style={{ flex: 1, backgroundColor: p.background, padding: 24 }}>{error ? <><Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text><Button onPress={() => { setError(''); setAttempt(value => value + 1) }}>Try again</Button></> : <PageSkeleton />}</View>
}
