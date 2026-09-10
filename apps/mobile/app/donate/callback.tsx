import { ScrollView } from 'react-native'
import { Text } from 'react-native-paper'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { PaymentStatus } from '@/components/PaymentStatus'
import { Button } from '@/components/Loading'
import { usePalette } from '@/context/ColorModeContext'

/** The reference locates a payment; only the server can confirm it. */
export default function DonationCallback() {
  const p = usePalette()
  const { reference, trxref } = useLocalSearchParams<{ reference?: string; trxref?: string }>()
  const value = reference || trxref || ''
  const intentId = /^uf-(.+)-[0-9a-f]{8}$/i.exec(value)?.[1]
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Stack.Screen options={{ title: 'Payment confirmation' }} />
    {intentId ? <PaymentStatus key={intentId} payment={{ id: intentId, status: 'PENDING', reference: value, storageKey: '' }} onReset={() => router.replace('/(tabs)/explore')} /> : <>
      <Text variant="headlineSmall">Return to your donation</Text>
      <Text>This link has no payment reference we can check. Reopen the campaign you supported to recover its pending checkout. Please check its status before paying again.</Text>
      <Button onPress={() => router.replace('/(tabs)/explore')}>Explore campaigns</Button>
    </>}
  </ScrollView>
}
