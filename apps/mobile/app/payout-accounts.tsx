import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import { SavedPayoutAccounts } from '@/components/SavedPayoutAccounts'
import { PayoutAccounts } from '@/components/PayoutAccounts'
import { usePalette } from '@/context/ColorModeContext'
export default function PayoutAccountsScreen() {
  const p = usePalette()
  const { user } = useAuth()
  if (!user) return <SignInRequired what="payout accounts" />
  return (
    <ScrollView
      style={{ backgroundColor: p.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 32 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Payout accounts' }} />
      <SavedPayoutAccounts />
      <PayoutAccounts />
    </ScrollView>
  )
}
