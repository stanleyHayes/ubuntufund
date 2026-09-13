import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Switch, Text } from 'react-native-paper'
import { ACTIVITY_ALERT_CATEGORIES, ACTIVITY_ALERT_LABELS, type ActivityAlertCategory, type ActivityAlertChannel, type ActivityAlertPreferences } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { usePalette } from '@/context/ColorModeContext'
import { Button, Skeleton } from './Loading'

interface Settings { preferences: ActivityAlertPreferences; emailVerified: boolean; emailConfigured: boolean }
export function ActivityAlertSettings() {
  const p = usePalette()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    void api.get<Settings>('/profile/activity-alerts').then(result => { if (active) setSettings(result) }).catch(() => { if (active) setError('Could not load activity alert preferences.') })
    return () => { active = false }
  }, [retry])
  async function save(category: ActivityAlertCategory, channel: ActivityAlertChannel, enabled: boolean) {
    setBusy(true); setError(''); setMessage('')
    try {
      await api.put('/profile/activity-alerts', { category, channel, enabled })
      setSettings(previous => previous && ({ ...previous, preferences: { ...previous.preferences, [category]: { ...previous.preferences[category], [channel]: enabled } } }))
      setMessage(`${ACTIVITY_ALERT_LABELS[category]} ${channel === 'inApp' ? 'in-app alerts' : 'emails'} ${enabled ? 'enabled' : 'turned off'}.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your preference.') }
    finally { setBusy(false) }
  }
  async function requestVerification() {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await api.post<{ emailVerified: boolean }>('/email-verification', {})
      if (result.emailVerified) setRetry(value => value + 1)
      setMessage(result.emailVerified ? 'Your email is already verified.' : 'Check your email for a verification link, then return here and check verification status. Allow a minute before requesting another link.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not request verification. Please try again.') }
    finally { setBusy(false) }
  }
  return <View style={{ gap: 14 }}>
    <Text variant="titleMedium">Activity alerts and emails</Text>
    <Text style={{ color: p.textSecondary }}>Everything starts off. Choose each activity and channel. In-app alerts appear in your notification inbox. Choices apply to future activity and can be turned off at any time.</Text>
    <Text style={{ color: p.textSecondary }}>Account verification, password recovery and password-change security notices remain separate. This does not subscribe you to marketing.</Text>
    {error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
    {message && <Text accessibilityRole="alert" style={{ color: p.success }}>{message}</Text>}
    {!settings ? error ? <Button onPress={() => setRetry(value => value + 1)}>Retry</Button> : <Skeleton height={180} /> : <>
      {!settings.emailVerified && <View style={{ gap: 8 }}><Text>Verify your email address to enable activity emails. In-app alerts are available now.</Text><Button disabled={busy} onPress={() => void requestVerification()}>Send verification link</Button><Button disabled={busy} onPress={() => setRetry(value => value + 1)}>Check verification status</Button></View>}
      {!settings.emailConfigured && <Text>Email delivery is temporarily unavailable. You can still save your choices.</Text>}
      {ACTIVITY_ALERT_CATEGORIES.map(category => <View key={category} style={{ gap: 6 }}>
        <Text style={{ color: p.text, fontFamily: 'Outfit_600SemiBold' }}>{ACTIVITY_ALERT_LABELS[category]}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
          {(['inApp', 'email'] as const).map(channel => <View key={channel} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text>{channel === 'inApp' ? 'In-app alert' : 'Email'}</Text>
            <Switch accessibilityLabel={`${ACTIVITY_ALERT_LABELS[category]} ${channel === 'inApp' ? 'in-app alerts' : 'emails'}`} value={settings.preferences[category][channel]} disabled={busy || (channel === 'email' && !settings.emailVerified && !settings.preferences[category][channel])} onValueChange={value => void save(category, channel, value)} />
          </View>)}
        </View>
      </View>)}
    </>}
  </View>
}
