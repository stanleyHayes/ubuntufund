import { useEffect, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { api } from '@/lib/api'
import { useSeo } from '@/lib/seo'

type State = 'idle' | 'saving' | 'done' | 'invalid' | 'error'

/** One-click stop for campaign thank-you emails, from the link in any of them. No sign-in needed. */
export function ThankYouUnsubscribePage() {
  useSeo({ title: 'Stop thank-you messages | Ujimora', description: 'Stop thank-you emails from campaigns you supported on Ujimora.', path: '/unsubscribe/thank-you', robots: 'noindex, nofollow' })
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [state, setState] = useState<State>('idle')
  // Keep the link's token out of the address bar and browser history.
  useEffect(() => { if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname) }, [])
  const usable = /^[A-Za-z0-9._-]{16,512}$/.test(token)

  async function unsubscribe() {
    setState('saving')
    try {
      await api.post('/donor-messages/unsubscribe', { token })
      setState('done')
    } catch (err) {
      setState((err as { status?: unknown } | null)?.status === 400 ? 'invalid' : 'error')
    }
  }

  return <AuthLayout><meta name="referrer" content="no-referrer" /><Stack spacing={3}>
    <Typography variant="h4" component="h1">Stop thank-you messages</Typography>
    {state === 'done' ? (
      <Alert severity="success" role="status">
        Done. Campaigns will not send thank-you messages to this email address. Other Ujimora emails are not affected.
      </Alert>
    ) : state === 'invalid' || !usable ? (
      <Alert severity="warning">
        This link is not valid. Open the complete link from your email. If you have an account, you can also turn these
        messages off in Settings.
      </Alert>
    ) : (
      <>
        <Typography>
          After a campaign you supported ends or pays out, its organizer or beneficiary can send donors a thank-you
          through Ujimora. Stop these messages for this email address. You do not need to sign in.
        </Typography>
        {state === 'error' && <Alert severity="error">We could not save your choice. Please try again.</Alert>}
        <Button variant="contained" disabled={state === 'saving'} onClick={() => void unsubscribe()}>
          {state === 'saving' ? 'Saving…' : 'Stop thank-you messages'}
        </Button>
      </>
    )}
    <Button component={Link} to="/settings">Go to Settings</Button>
  </Stack></AuthLayout>
}
