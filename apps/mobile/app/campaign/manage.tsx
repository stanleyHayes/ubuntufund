import { CampaignCashout } from '@/components/CampaignCashout'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { Text } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { SignInRequired } from '@/components/SignInRequired'
import { PageSkeleton, Button } from '@/components/Loading'
import { CollaboratorManager, SplitManager, QrManager } from '@/components/CampaignManagement'
export default function CampaignManagement() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { user } = useAuth(); const p = usePalette()
  const [campaign, setCampaign] = useState<{ creatorId: string; title: string } | null>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0)
  useEffect(() => { let active = true; if (id && user) api.get<{ creatorId: string; title: string }>(`/campaigns/${id}`).then(value => { if (active) setCampaign(value) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not open campaign.') }); return () => { active = false } }, [id, user, retry])
  if (!user) return <SignInRequired what="campaign management" />
  if (error) return <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => { setError(''); setRetry(value => value + 1) }}>Try again</Button></>
  if (!campaign) return <PageSkeleton />
  if (campaign.creatorId !== user.id) return <Text>Only the campaign owner can manage these settings.</Text>
  return <ScrollView automaticallyAdjustKeyboardInsets style={{ backgroundColor: p.background, flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 24 }}><Stack.Screen options={{ title: 'Manage campaign' }} /><Text variant="headlineMedium">{campaign.title}</Text><CampaignCashout campaignId={id} /><CollaboratorManager campaignId={id} /><SplitManager campaignId={id} /><QrManager campaignId={id} /></ScrollView>
}
