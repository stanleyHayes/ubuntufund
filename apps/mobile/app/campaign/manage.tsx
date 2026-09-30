import { CampaignCashout } from '@/components/CampaignCashout'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import type { Campaign } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useNeu, usePalette } from '@/context/ColorModeContext'
import { SignInRequired } from '@/components/SignInRequired'
import { PageSkeleton, Button } from '@/components/Loading'
import { CollaboratorManager, SplitManager, QrManager } from '@/components/CampaignManagement'
import { KeyboardAvoider } from '@/components/KeyboardAvoider'
import { OnBehalfStatus } from '@/components/OnBehalfStatus'
import { canOpenManagement, canThankDonors, hasPayoutAuthority, payoutNote } from '@/lib/onBehalf'
type ManagedCampaign = Pick<Campaign, 'creatorId' | 'title' | 'onBehalf' | 'viewerAccess'>
export default function CampaignManagement() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { user } = useAuth(); const p = usePalette(); const neu = useNeu()
  const [campaign, setCampaign] = useState<ManagedCampaign | null>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0)
  useEffect(() => { let active = true; if (id && user) api.get<ManagedCampaign>(`/campaigns/${id}`).then(value => { if (active) setCampaign(value) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not open campaign.') }); return () => { active = false } }, [id, user, retry])
  if (!user) return <SignInRequired what="campaign management" />
  if (error) return <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => { setError(''); setRetry(value => value + 1) }}>Try again</Button></>
  if (!campaign) return <PageSkeleton />
  if (!canOpenManagement(campaign, user.id)) return <Text>Only the campaign owner can manage these settings.</Text>
  // Payout controls follow payout authority, not ownership; collaborators, split and QR stay with the owner account.
  const owner = campaign.creatorId === user.id
  const payouts = hasPayoutAuthority(campaign, user.id)
  const card = { ...neu.raised, backgroundColor: p.surface, borderRadius: 20, padding: 20, gap: 10 }
  return <KeyboardAvoider style={{ backgroundColor: p.background }}><ScrollView automaticallyAdjustKeyboardInsets style={{ backgroundColor: p.background, flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 24 }}><Stack.Screen options={{ title: 'Manage campaign' }} /><Text variant="headlineMedium">{campaign.title}</Text>
    {campaign.onBehalf && <OnBehalfStatus campaignId={id} summary={campaign.onBehalf} payoutAuthority={payouts} />}
    {canThankDonors(campaign) && <View style={card}>
      <Text variant="titleLarge">Thank your donors</Text>
      <Text style={{ color: p.textSecondary }}>Once the campaign has ended or a payout has been paid, send one thank-you message to everyone who gave. Ujimora emails it for you.</Text>
      <Button mode="contained-tonal" icon="email-fast-outline" onPress={() => router.push({ pathname: '/campaign/thank-you', params: { id } })}>Thank your donors</Button>
    </View>}
    {payouts ? <CampaignCashout campaignId={id} beneficiaryName={campaign.onBehalf?.beneficiaryName} />
      : !campaign.onBehalf && <View style={[card, { flexDirection: 'row', alignItems: 'center' }]}><Icon source="bank-off-outline" size={20} color={p.textSecondary} /><Text style={{ flex: 1, color: p.textSecondary }}>{payoutNote(campaign)}</Text></View>}
    {owner && <><CollaboratorManager campaignId={id} /><SplitManager campaignId={id} /><QrManager campaignId={id} /></>}
  </ScrollView></KeyboardAvoider>
}
