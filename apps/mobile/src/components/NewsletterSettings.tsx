import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Switch, Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { Button } from './Loading'
import { usePalette } from '@/context/ColorModeContext'
type Preference = { status: 'off' | 'pending' | 'active' }
export function NewsletterSettings() {
  const p = usePalette()
  const [preference, setPreference] = useState<Preference | null>(null), [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    setMessage('')
    void api.get<Preference>('/newsletter/preference').then(value => { if (!['off', 'pending', 'active'].includes(value?.status)) throw new Error('Invalid preference response'); if (active) { setPreference(value); setError('') } }).catch(() => { if (active) setError('Could not load your newsletter choice.') })
    return () => { active = false }
  }, [revision])
  async function save(enabled: boolean) {
    setBusy(true); setError(''); setMessage('')
    try { const result = await api.put<Preference>('/newsletter/preference', { enabled }); setPreference(result); setMessage(result.status === 'pending' ? 'Check your email to confirm. No newsletters will be sent until you confirm.' : result.status === 'active' ? 'Your newsletter subscription is active.' : 'Newsletter emails are off.') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save your choice. Please try again.') }
    finally { setBusy(false) }
  }
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text variant="titleMedium">Marketing emails and newsletter</Text>
    <Text>Optional Ujimora stories and promotional updates. Turning this on requests a confirmation email. Turn it off here or use the unsubscribe link in an email.</Text>
    {error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}{message && <Text accessibilityRole="alert" style={{ color: p.success }}>{message}</Text>}
    {preference && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1 }}>{preference.status === 'pending' ? 'Requested — awaiting email confirmation' : preference.status === 'active' ? 'Subscribed' : 'Off'}</Text><Switch accessibilityLabel="Marketing emails and newsletter" value={preference.status !== 'off'} disabled={busy} onValueChange={enabled => void save(enabled)} /></View>}
    {preference?.status === 'pending' && <Button disabled={busy} onPress={() => void save(true)}>Resend newsletter confirmation</Button>}
    <Button onPress={() => setRevision(value => value + 1)} disabled={busy}>Refresh newsletter status</Button>
  </View>
}
