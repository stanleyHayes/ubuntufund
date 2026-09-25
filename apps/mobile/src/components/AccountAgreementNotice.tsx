import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { router } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { agreementNotice } from '@/lib/agreementStatus'
import { Button } from './Loading'
export function AccountAgreementNotice() {
  const { user, isAuthenticated, legalStatus } = useAuth()
  const p = usePalette()
  // The server's status wins; the bundled constant is only a fallback before it loads.
  const notice = agreementNotice(isAuthenticated, user?.legalAcceptance, legalStatus)
  if (notice === 'hidden') return null
  return <View style={{ padding: 12, backgroundColor: p.background }}>
    <Text style={{ color: p.text }}>{notice === 'update-app'
      ? 'An updated account agreement is available. Update Ujimora to review it before publishing or uploading content.'
      : 'Review the account agreement before publishing or uploading content.'}</Text>
    <Button onPress={() => router.push('/account-agreement')}>Review agreement</Button>
  </View>
}
