import { useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { Button } from './Loading'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ReportContent } from './ReportContent'
export function UserSafetyControls({ userId, onBlocked, liveSessionId }: { userId: string; onBlocked: () => void; liveSessionId?: string }) {
  const { user } = useAuth()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  if (!user || !userId || user.id === userId) return null
  async function block() {
    setBusy(true); setError('')
    try { await api.put(`/safety/blocks/${userId}`, {}); onBlocked() }
    catch { setError('Could not block this user. Please try again.') }
    finally { setBusy(false) }
  }
  return <View><ReportContent userId={userId} liveSessionId={liveSessionId} /><Button disabled={busy} onPress={() => void block()}>Block user</Button>{error && <Text accessibilityRole="alert">{error}</Text>}</View>
}
