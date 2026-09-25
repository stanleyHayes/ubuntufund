import { useState } from 'react'
import { acceptsCampaignDonation } from '@ubuntu-fund/types'
import { Linking, ScrollView } from 'react-native'
import { Text } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCampaign } from '@/hooks/useCampaigns'
import { usePalette } from '@/context/ColorModeContext'
import { Button, PageSkeleton } from '@/components/Loading'
import { campaignDonationHandle, fundraisingUrl } from '@/lib/fundraising'

/** iOS fundraising takes place in the external browser (card, mobile money and, when enabled, crypto). */
export default function ExternalFundraisingScreen() {
  const { id, amount, liveSessionId } = useLocalSearchParams<{ id: string; amount?: string; liveSessionId?: string }>()
  const { campaign, isLoading, error: loadError } = useCampaign(id || '')
  const palette = usePalette()
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  // Legacy campaigns without a slug use their id; the website accepts either.
  const handle = campaign ? campaignDonationHandle(campaign) : ''
  async function open() {
    if (!handle || !acceptsCampaignDonation(campaign)) return
    setOpening(true); setError('')
    try { await Linking.openURL(fundraisingUrl(handle, { amount, liveSessionId })) }
    catch { setError('Could not open the donation website. Please try again.') }
    finally { setOpening(false) }
  }
  if (isLoading) return <PageSkeleton />
  return <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Stack.Screen options={{ title: 'Support this campaign' }} />
    <Text variant="headlineMedium" style={{ color: palette.text }}>{campaign?.title || 'Campaign donation'}</Text>
    <Text style={{ color: palette.textSecondary }}>Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.</Text>
    {(error || loadError) && <Text accessibilityRole="alert" style={{ color: palette.error }}>{error || loadError}</Text>}
    {handle && acceptsCampaignDonation(campaign) ? <Button mode="contained" icon="open-in-new" loading={opening} disabled={opening || !!loadError} onPress={() => void open()}>Continue in browser</Button> : <Text>This campaign is not accepting donations right now.</Text>}
    <Text style={{ color: palette.textSecondary }}>Returning to the app does not confirm payment. Check the payment status on the website before trying again.</Text>
  </ScrollView>
}
