import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { api } from '@/lib/api'

/**
 * Shown where an unverified email blocks something: automatic payouts fall back
 * to manual review and organization invitations cannot be accepted. Hidden when
 * the address is verified, when email delivery is unavailable, or while loading.
 */
export function EmailVerificationNotice({ reason = 'Automatic payouts and organization invitations need a verified email address.' }: { reason?: string }) {
  const [status, setStatus] = useState<{ emailVerified: boolean; deliveryConfigured: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.get<{ emailVerified: boolean; deliveryConfigured: boolean }>('/email-verification')
      .then(value => { if (active && typeof value?.emailVerified === 'boolean') setStatus(value) })
      .catch(() => { /* Not shown when the status cannot be read. */ })
    return () => { active = false }
  }, [])
  if (!status || status.emailVerified || !status.deliveryConfigured) return null
  async function send() {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await api.post<{ emailVerified: boolean }>('/email-verification', {})
      if (result.emailVerified) setStatus(previous => previous && { ...previous, emailVerified: true })
      else setMessage('Check your email for a verification link. Allow a minute before requesting another.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a verification link. Please try again.')
    } finally { setBusy(false) }
  }
  return (
    <Alert severity={error ? 'error' : 'info'} sx={{ mb: 3 }} action={<Button color="inherit" size="small" disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : 'Send link'}</Button>}>
      {error || message || `Verify your email address. ${reason}`}
    </Alert>
  )
}
