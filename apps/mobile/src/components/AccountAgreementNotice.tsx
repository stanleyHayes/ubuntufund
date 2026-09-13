import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { router } from 'expo-router'
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { Button } from './Loading'
export function AccountAgreementNotice() {
  const { user, isAuthenticated } = useAuth()
  const p = usePalette()
  if (!isAuthenticated || hasCurrentLegalAcceptance(user?.legalAcceptance)) return null
  return <View style={{ padding: 12, backgroundColor: p.background }}><Text style={{ color: p.text }}>Review the account agreement before publishing or uploading content.</Text><Button onPress={() => router.push('/account-agreement')}>Review agreement</Button></View>
}
