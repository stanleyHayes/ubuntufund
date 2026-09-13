import { useState } from 'react'
import { Alert, Button, Checkbox, FormControlLabel, Link, Stack, TextField, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export function NewsletterSignup({ label = 'Newsletter signup' }: { label?: string }) {
  const [email, setEmail] = useState(''), [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!consent) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/v1/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), consent: true }) })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('unavailable')
      await response.json()
      setMessage('Check your email to confirm. No newsletters will be sent until you confirm; existing confirmed subscriptions stay unchanged.')
      setEmail(''); setConsent(false)
    } catch { setError('Could not request a subscription. Please try again later.') }
    finally { setBusy(false) }
  }
  return <Stack component="form" aria-label={label} onSubmit={event => void submit(event)} spacing={1.5}>
    <TextField label="Newsletter email address" type="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} size="small" sx={{ bgcolor: '#F6F5F0', borderRadius: 2, '& .MuiInputBase-input': { color: '#1C261D' }, '& .MuiInputLabel-root': { color: '#465548' } }} />
    <FormControlLabel sx={{ color: '#fff', alignItems: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: '0.82rem', pt: 1 } }} control={<Checkbox checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} sx={{ color: '#CFD7D0', '&.Mui-checked': { color: '#C7A24A' } }} />} label="Email me Ujimora stories and promotional updates." />
    <Typography variant="caption" sx={{ color: '#CFD7D0' }}>Optional. Confirm by email and unsubscribe at any time. <Link component={RouterLink} to="/privacy" sx={{ color: '#F0D890' }}>Privacy notice</Link></Typography>
    <Button type="submit" variant="contained" disabled={busy || !consent} sx={{ bgcolor: '#C7A24A', color: '#1C261D', '&:hover': { bgcolor: '#DCC07E' }, '&.Mui-disabled': { bgcolor: '#647064', color: '#F6F5F0' } }}>{busy ? 'Requesting…' : 'Subscribe'}</Button>
    {message && <Alert severity="success" role="status">{message}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>
}
