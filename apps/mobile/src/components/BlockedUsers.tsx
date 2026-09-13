import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { Button } from './Loading'
import { api } from '@/lib/api'
export function BlockedUsers({ revision = 0, onChange }: { revision?: number; onChange?: () => void }) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    api.get<{ items: typeof items }>('/safety/blocks').then(data => { if (active) { setItems(data.items); setError('') } }).catch(() => { if (active) setError('Could not load blocked users.') })
    return () => { active = false }
  }, [revision, refresh])
  async function unblock(id: string) {
    try { await api.delete(`/safety/blocks/${id}`); setItems(current => current.filter(item => item.id !== id)); setError(''); onChange?.() }
    catch { setError('Could not unblock this user. Please try again.') }
  }
  if (!items.length && !error) return null
  return <View style={{ gap: 8 }}><Text variant="titleSmall">Blocked users</Text>
    <Text>Blocked users’ comments are hidden from each other. Blocking does not submit a moderation report.</Text>
    {error && <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => setRefresh(value => value + 1)}>Retry</Button></>}
    {items.map(item => <Button key={item.id} onPress={() => void unblock(item.id)}>Unblock {item.name}</Button>)}
  </View>
}
