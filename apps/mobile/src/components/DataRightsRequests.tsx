import { useCallback, useEffect, useState } from 'react'
import { Linking, Share, View } from 'react-native'
import { Button, RadioButton, Text, TextInput } from 'react-native-paper'
import { api } from '@/lib/api'
type Item = { _id: string; kind: string; details: string; status: string; response: string; dueAt: string }
const labels: Record<string, string> = { access: 'Access to my data', correction: 'Correct my data', complaint: 'Privacy complaint' }
export function DataRightsRequests() {
  const [items, setItems] = useState<Item[]>([]), [kind, setKind] = useState('access'), [details, setDetails] = useState('')
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.get<{ items: Item[]; total: number }>(`/data-rights?page=${page}`); if (!Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('Invalid request response'); setItems(data.items); setTotal(data.total); setError('') }
    catch { setError('Could not load privacy requests. Please retry.') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])
  async function submit() {
    setBusy(true); setError(''); setMessage('')
    try { await api.post('/data-rights', { kind, details }); setDetails(''); setMessage('Request received. Check this section for its response.'); if (page !== 1) setPage(1); else await load() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not submit your request.') }
    finally { setBusy(false) }
  }
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text variant="titleMedium">Your data and privacy requests</Text>
    <Text>Ask for a copy of your personal data, a correction or a privacy review. We aim to respond within 30 days. Check progress and read the response here. This does not close your account.</Text>
    {!!error && <Text accessibilityRole="alert">{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    <RadioButton.Group value={kind} onValueChange={setKind}>{Object.entries(labels).map(([value, label]) => <RadioButton.Item key={value} value={value} label={label} />)}</RadioButton.Group>
    <TextInput mode="outlined" multiline label="What would you like us to review?" value={details} onChangeText={setDetails} maxLength={5000} />
    <Text>Describe the records or correction you need. Do not include passwords, card numbers or identity-document images.</Text>
    <Button mode="outlined" disabled={busy || details.trim().length < 10} onPress={() => void submit()}>{busy ? 'Submitting…' : 'Submit privacy request'}</Button>
    <Button disabled={loading || busy} onPress={() => void load()}>Refresh privacy requests</Button>
    {loading ? <Text>Loading requests…</Text> : items.map(item => <View key={item._id} style={{ padding: 12, gap: 8 }}>
      <Text variant="titleSmall">{labels[item.kind]} · {item.status.replace('_', ' ')}</Text>
      <Text>Reference {item._id} · Response target {new Date(item.dueAt).toLocaleDateString()}</Text>
      <Text>{item.details}</Text>
      {!!item.response && <><Text variant="titleSmall">Response</Text><Text>{item.response}</Text><Button onPress={() => void Share.share({ message: JSON.stringify(item, null, 2), title: 'Ujimora privacy request and response' }).catch(() => setError('Could not share the response. Please try again.'))}>Share request and response</Button></>}
    </View>)}
    {!loading && !items.length && <Text>No privacy requests yet.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}><Button disabled={page === 1 || loading} onPress={() => setPage(page - 1)}>Previous requests</Button><Button disabled={page * 10 >= total || loading} onPress={() => setPage(page + 1)}>More requests</Button></View>
    <Button onPress={() => void Linking.openURL('mailto:legal@ujimora.com').catch(() => setError('Email legal@ujimora.com for help.'))}>Contact the privacy team</Button>
    <Button onPress={() => void Linking.openURL('https://dpc.gov.gh/for-individuals/').catch(() => setError('Visit dpc.gov.gh for the Data Protection Commission.'))}>Ghana Data Protection Commission</Button>
  </View>
}
