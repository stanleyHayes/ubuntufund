import { useEffect, useState } from 'react'
import { Alert, Button, FormControlLabel, Skeleton, Stack, Switch, Typography } from '@mui/material'
import { api } from '@/lib/api'

const LABEL = 'Thank-you messages from campaigns I supported'

/** Whether campaigns this donor gave to may send them their one thank-you email. */
export function DonorMessageSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    api.get<{ thankYouEmails?: unknown }>('/profile/donor-messages')
      .then((value) => {
        if (!active) return
        if (typeof value?.thankYouEmails !== 'boolean') throw new Error('Invalid preference response')
        setEnabled(value.thankYouEmails)
        setError('')
      })
      .catch(() => { if (active) setError('Could not load your thank-you message choice.') })
    return () => { active = false }
  }, [revision])
  async function save(next: boolean) {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await api.put<{ thankYouEmails: boolean }>('/profile/donor-messages', { thankYouEmails: next })
      setEnabled(typeof result?.thankYouEmails === 'boolean' ? result.thankYouEmails : next)
      setMessage(next ? 'Campaigns you supported can send you their thank-you.' : 'You will not get thank-you messages from campaigns.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your choice. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack spacing={1.5} sx={{ py: 2 }}>
      <Typography fontWeight={700}>{LABEL}</Typography>
      <Typography variant="body2">
        When a campaign you gave to ends or pays out, its organizer or beneficiary can send donors a thank-you. Ujimora
        emails it for them, so they never see your email address. Every message also has an unsubscribe link.
      </Typography>
      {error && <Alert severity="error" action={enabled === null ? <Button color="inherit" onClick={() => setRevision((value) => value + 1)}>Retry</Button> : undefined}>{error}</Alert>}
      {message && <Alert severity="success" role="status">{message}</Alert>}
      {enabled === null ? (
        !error && <Skeleton variant="rounded" height={38} width={160} />
      ) : (
        <FormControlLabel
          label={enabled ? 'On' : 'Off'}
          control={<Switch checked={enabled} disabled={busy} onChange={(event) => void save(event.target.checked)} slotProps={{ input: { role: 'switch', 'aria-label': LABEL } }} />}
        />
      )}
    </Stack>
  )
}
