import { useCallback, useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import { Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { Button } from './Loading'
import { useNeu } from '@/context/ColorModeContext'
type Notice = { id: string; title: string; message: string; read: boolean }
export function OwnerNotifications() {
  const neu = useNeu(); const [items, setItems] = useState<Notice[]>([]); const [error, setError] = useState(''); const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useEffect(() => { let active = true; api.get<Notice[]>('/notifications').then(r => { if (active) { setItems(r); setError('') } }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [revision])
  useEffect(() => { const timer = setInterval(() => { if (AppState.currentState === 'active') refresh() }, 30000); const listener = AppState.addEventListener('change', s => { if (s === 'active') refresh() }); return () => { clearInterval(timer); listener.remove() } }, [refresh])
  return <View style={{ ...neu.raised, margin: 16, padding: 20, borderRadius: 20, gap: 12 }}><Text variant="titleLarge">Notifications</Text>{error ? <><Text accessibilityRole="alert">{error}</Text><Button onPress={refresh}>Retry</Button></> : items.length === 0 ? <Text>New campaign donations will appear here.</Text> : items.slice(0, 10).map(n => <View key={n.id} style={{ gap: 6 }}><Text variant="titleSmall">{n.title}{n.read ? '' : ' · New'}</Text><Text>{n.message}</Text>{!n.read && <Button onPress={() => { void api.put(`/notifications/${n.id}/read`, {}).then(refresh).catch(e => setError(e.message)) }}>Mark as read</Button>}</View>)}</View>
}
