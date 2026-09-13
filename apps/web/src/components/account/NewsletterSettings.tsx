import { useEffect, useState } from 'react'
import { Alert, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { api } from '@/lib/api'
type Preference = { status: 'off' | 'pending' | 'active' }
export function NewsletterSettings() {
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
  return <Stack spacing={1.5} sx={{ py: 2 }}>
    <Typography fontWeight={700}>Marketing emails and newsletter</Typography>
    <Typography variant="body2">Optional Ujimora stories and promotional updates. Turning this on requests a confirmation email. Turn it off here or use the unsubscribe link in an email.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success" role="status">{message}</Alert>}
    {preference && <FormControlLabel label={preference.status === 'pending' ? 'Requested — awaiting email confirmation' : preference.status === 'active' ? 'Subscribed' : 'Off'} control={<Switch slotProps={{ input: { role: 'switch', 'aria-label': 'Marketing emails and newsletter' } }} checked={preference.status !== 'off'} disabled={busy} onChange={event => void save(event.target.checked)} />} />}
    {preference?.status === 'pending' && <Button disabled={busy} onClick={() => void save(true)}>Resend newsletter confirmation</Button>}
    <Button onClick={() => setRevision(value => value + 1)} disabled={busy}>Refresh newsletter status</Button>
  </Stack>
}
