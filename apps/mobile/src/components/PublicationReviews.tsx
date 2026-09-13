import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
function displayText(action: string, text: string): string {
  if (action === 'campaign.create' || action === 'creator.profile' || action === 'organization.profile' || action === 'account.profile') {
    try { const fields: unknown = JSON.parse(text); if (fields && typeof fields === 'object' && !Array.isArray(fields)) return Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('\n\n') } catch { /* Show original evidence. */ }
  }
  if (!action.startsWith('update.')) return text
  try { const parts: unknown = JSON.parse(text); if (Array.isArray(parts) && parts.length === 3 && parts.every(part => typeof part === 'string')) return `${parts[0]}\n\n${parts[1]}\n\nUpdate type: ${parts[2]}` } catch { /* Keep the original evidence if it is not structured text. */ }
  return text
}
type Item = { id: string; action: string; text: string; status: string; reviewNotes?: string; approvalExpiresAt?: string }
export function PublicationReviews() {
  const { user } = useAuth()
  return <ViewerReviews key={user?.id ?? 'guest'} />
}
function ViewerReviews() {
  const [items, setItems] = useState<Item[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.get<{ items: Item[]; total: number }>(`/publication-reviews?page=${page}`); setItems(data.items); setTotal(data.total); setError('') }
    catch { setItems([]); setError('Could not load publication reviews. Please retry.') }
    finally { setLoading(false) }
  }, [page])
  useFocusEffect(useCallback(() => { void load() }, [load]))
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text variant="titleMedium">Publication reviews</Text>
    <Text>Held campaigns, account identity, creator-page and organization identity changes, URL changes, comments and updates stay private. After approval, submit the same version from its original form within seven days. Changed content needs a new check. For an appeal, contact support@ujimora.com with the reference below.</Text>
    <Button disabled={loading} onPress={() => void load()}>Refresh publication reviews</Button>
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
    {loading ? <Text>Loading reviews…</Text> : items.map(item => <View key={item.id} style={{ gap: 6, paddingVertical: 12 }}>
      <Text variant="titleSmall">{item.action.replace('.', ' ')} · {item.status}</Text><Text>Reference {item.id}</Text>
      <Text selectable>{displayText(item.action, item.text)}</Text>
      {!!item.reviewNotes && <Text>Review response: {item.reviewNotes}</Text>}
      {!!item.approvalExpiresAt && <Text>Approval expires {new Date(item.approvalExpiresAt).toLocaleString()}</Text>}
    </View>)}
    {!loading && !items.length && !error && <Text>No publication reviews yet.</Text>}
    <View style={{ flexDirection: 'row', gap: 8 }}><Button disabled={loading || page === 1} onPress={() => setPage(page - 1)}>Previous</Button><Button disabled={loading || page * 25 >= total} onPress={() => setPage(page + 1)}>Next</Button></View>
  </View>
}
