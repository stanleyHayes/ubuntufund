import { useEffect, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { api } from '@/lib/api'
import { useSeo } from '@/lib/seo'

export function VerifyEmailPage() {
  useSeo({ title: 'Verify your email | Ujimora', description: 'Confirm ownership of your Ujimora email address.', path: '/verify-email', robots: 'noindex, nofollow' })
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { window.history.replaceState(window.history.state, '', window.location.pathname) }, [])
  async function confirm() {
    setBusy(true); setError('')
    try { await api.post('/email-verification/confirm', { token }); setDone(true) }
    catch { setError('This link could not be confirmed. It may have expired or been used. Try again, or request a new link in Settings.') }
    finally { setBusy(false) }
  }
  return <AuthLayout><meta name="referrer" content="no-referrer" /><Stack spacing={3}>
    <Typography variant="h4" component="h1">Verify your email address</Typography>
    {done ? <Alert severity="success">Your email is verified. Your activity and marketing choices have not changed. Return to Settings in the app and check verification status to choose activity emails.</Alert>
      : !/^[a-f0-9]{64}$/i.test(token) ? <Alert severity="warning">Open the complete link from your verification email. If you refreshed this page, reopen the email link or request a new one in Settings.</Alert>
      : <><Typography>Confirm that you own this email address. This does not sign you in or subscribe you to any emails.</Typography>{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" onClick={() => void confirm()} disabled={busy}>{busy ? 'Verifying…' : 'Verify email address'}</Button></>}
    <Button component={Link} to="/settings">Go to Settings</Button>
  </Stack></AuthLayout>
}
