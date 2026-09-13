import { useEffect, useState } from 'react'
import { Alert, Box, Button, FormControlLabel, Skeleton, Stack, Switch, Typography } from '@mui/material'
import { ACTIVITY_ALERT_CATEGORIES, ACTIVITY_ALERT_LABELS, type ActivityAlertCategory, type ActivityAlertChannel, type ActivityAlertPreferences } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

interface Settings { preferences: ActivityAlertPreferences; emailVerified: boolean; emailConfigured: boolean }
export function ActivityAlertSettings() {
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your preference. Please try again.') }
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
  return <Stack spacing={2} sx={{ py: 2 }}>
    <Typography variant="subtitle1" fontWeight={700}>Activity alerts and emails</Typography>
    <Typography variant="body2" color="text.secondary">Everything starts off. Choose each activity and how you want to hear about it. In-app alerts appear in your notification inbox. Choices apply to future activity; you can turn them off at any time.</Typography>
    <Typography variant="body2" color="text.secondary">Account verification, password recovery and password-change security notices remain separate. These choices do not subscribe you to marketing.</Typography>
    {error && <Alert severity="error" action={!settings ? <Button onClick={() => setRetry(value => value + 1)}>Retry</Button> : undefined}>{error}</Alert>}
    {message && <Alert severity="success" role="status">{message}</Alert>}
    {!settings ? !error && <Skeleton height={180} variant="rounded" /> : <>
      {!settings.emailVerified && <Alert severity="info">Verify your email address to enable activity emails. In-app alerts are available now.
        <Stack direction="row" sx={{ flexWrap: 'wrap', mt: 1 }}><Button disabled={busy} onClick={() => void requestVerification()}>Send verification link</Button><Button disabled={busy} onClick={() => setRetry(value => value + 1)}>Check verification status</Button></Stack>
      </Alert>}
      {!settings.emailConfigured && <Alert severity="info">Email delivery is temporarily unavailable. You can still save your choices.</Alert>}
      {ACTIVITY_ALERT_CATEGORIES.map(category => <Box key={category} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
        <Typography fontWeight={600}>{ACTIVITY_ALERT_LABELS[category]}</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
          {(['inApp', 'email'] as const).map(channel => <FormControlLabel key={channel} label={channel === 'inApp' ? 'In-app alert' : 'Email'} control={<Switch checked={settings.preferences[category][channel]} disabled={busy || (channel === 'email' && !settings.emailVerified && !settings.preferences[category][channel])} onChange={event => void save(category, channel, event.target.checked)} slotProps={{ input: { 'aria-label': `${ACTIVITY_ALERT_LABELS[category]} ${channel === 'inApp' ? 'in-app alerts' : 'emails'}` } }} />} />)}
        </Stack>
      </Box>)}
    </>}
  </Stack>
}
