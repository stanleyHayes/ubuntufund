import { useEffect, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { api } from '@/lib/api'
import { useSeo } from '@/lib/seo'
export function NewsletterConsentPage({ action }: { action: 'confirm' | 'unsubscribe' }) {
  const title = action === 'confirm' ? 'Confirm your newsletter subscription' : 'Unsubscribe from newsletters'
  useSeo({ title: `${title} | Ujimora`, description: 'Manage your optional Ujimora newsletter subscription.', path: `/newsletter/${action}`, robots: 'noindex, nofollow' })
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('')
  useEffect(() => { window.history.replaceState(window.history.state, '', window.location.pathname) }, [])
  async function submit() {
    setBusy(true); setError('')
    try { await api.post(`/newsletter/${action}`, { token }); setDone(true) }
    catch { setError('This link could not be used. Reopen the complete email link, use your newsletter controls in Settings, or contact support@ujimora.com.') }
    finally { setBusy(false) }
  }
  return <AuthLayout><meta name="referrer" content="no-referrer" /><Stack spacing={3}>
    <Typography variant="h4" component="h1">{title}</Typography>
    {done ? <Alert severity="success">{action === 'confirm' ? 'Your newsletter subscription is confirmed. You can unsubscribe at any time using the link in an email or your Settings.' : 'You are unsubscribed. Any pending confirmation request is cancelled. Your account and activity-alert choices are unchanged.'}</Alert>
      : !/^[a-f0-9]{64}$/i.test(token) ? <Alert severity="warning">Open the complete link from your email. No sign-in is needed. If you refreshed this page, reopen the email link.</Alert>
      : <><Typography>{action === 'confirm' ? 'Choose to receive Ujimora stories and promotional updates by email. This is optional and separate from account and activity messages.' : 'Stop Ujimora newsletter and promotional emails. You do not need to sign in.'}</Typography>{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe'}</Button></>}
    <Button component={Link} to="/settings">Go to Settings</Button>
    <Button href="mailto:support@ujimora.com">Contact support</Button>
  </Stack></AuthLayout>
}
