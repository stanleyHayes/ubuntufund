import { useEffect, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { api } from '@/lib/api'
import { useSeo } from '@/lib/seo'

export function ResetPasswordPage() {
  useSeo({ title: 'Reset your password | Ujimora', description: 'Choose a new password using your secure Ujimora recovery link.', path: '/reset-password', robots: 'noindex, nofollow' })
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { window.history.replaceState(window.history.state, '', window.location.pathname) }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (password.length < 8 || password.length > 128) { setError('Use between 8 and 128 characters.'); return }
    if (password !== confirmation) { setError('Your passwords do not match.'); return }
    setBusy(true)
    try { await api.post('/auth/reset-password', { token, newPassword: password }); setDone(true); setPassword(''); setConfirmation('') }
    catch { setError('The password could not be reset. The link may have expired or been used. Try again or request a new link.') }
    finally { setBusy(false) }
  }
  return <AuthLayout><meta name="referrer" content="no-referrer" /><Stack spacing={3}>
    <Typography variant="h4" component="h1">Choose a new password</Typography>
    {done ? <><Alert severity="success">Your password has changed and previous sessions have ended. Sign in with your new password.</Alert><Button component={Link} to="/login" variant="contained">Sign in</Button></>
      : !/^[a-f0-9]{64}$/i.test(token) ? <><Alert severity="warning">Open the complete link from your reset email. If you refreshed this page, reopen the email link.</Alert><Button component={Link} to="/forgot-password">Request a new link</Button></>
      : <Stack component="form" spacing={2} onSubmit={event => void submit(event)}>
        <Typography>Use 8–128 characters. A long, unique password helps protect your account.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="New password" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
        <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Changing password…' : 'Change password'}</Button>
        <Button component={Link} to="/forgot-password" disabled={busy}>Request a new link</Button>
      </Stack>}
  </Stack></AuthLayout>
}
