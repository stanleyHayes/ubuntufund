import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Switch, Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { usePalette } from '@/context/ColorModeContext'
import { Button, Skeleton } from './Loading'

type Preference = { thankYouEmails: boolean }

/** Thank-you emails from campaigns the signed-in donor gave to (opt-out; every email also has an unsubscribe link). */
export function DonorMessageSettings() {
  const p = usePalette()
  const [preference, setPreference] = useState<Preference | null>(null)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    api.get<Preference>('/profile/donor-messages')
      .then(value => { if (active) { setPreference({ thankYouEmails: value?.thankYouEmails !== false }); setError('') } })
      .catch(() => { if (active) setError('Could not load your thank-you message choice.') })
    return () => { active = false }
  }, [retry])
  async function save(thankYouEmails: boolean) {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await api.put<Preference>('/profile/donor-messages', { thankYouEmails })
      setPreference({ thankYouEmails: result?.thankYouEmails ?? thankYouEmails })
      setMessage(thankYouEmails ? 'Campaigns you supported can send you a thank-you message.' : 'You will not receive thank-you messages from campaigns.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your choice. Please try again.') }
    finally { setBusy(false) }
  }
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text variant="titleMedium">Thank-you messages</Text>
    <Text style={{ color: p.textSecondary }}>Campaigns you gave to can send you a thank-you message once they end or pay out. Ujimora emails it for them; your email address is never shared with them.</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: p.success }}>{message}</Text> : null}
    {preference ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ flex: 1, color: p.text }}>Thank-you messages from campaigns I supported</Text>
      <Switch accessibilityLabel="Thank-you messages from campaigns I supported" value={preference.thankYouEmails} disabled={busy} onValueChange={value => void save(value)} />
    </View> : error ? <Button onPress={() => setRetry(value => value + 1)}>Retry</Button> : <Skeleton height={44} />}
  </View>
}
