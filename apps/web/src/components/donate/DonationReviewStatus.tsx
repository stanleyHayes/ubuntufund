import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { DONATION_CONTENT_REVIEW_MESSAGES, type DonationContentReviewStatus } from '@ubuntu-fund/types'
import { getDonationIntentStatus } from '@/lib/fundraising'

/** Mount with the intent ID as key so a different payment cannot inherit review state. */
export function DonationReviewStatus({ intentId, initialStatus }: { intentId: string; initialStatus?: DonationContentReviewStatus }) {
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function refresh() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await getDonationIntentStatus(intentId)
      if (!active.current) return
      setStatus(result.contentReviewStatus ?? 'unavailable')
    } catch {
      if (active.current) { setStatus('unavailable'); setError('Could not refresh the content review. Please try again.') }
    } finally { if (active.current) setBusy(false) }
  }
  return <Stack spacing={1} sx={{ my: 2 }}>
    {status && DONATION_CONTENT_REVIEW_MESSAGES[status] && <Typography>{DONATION_CONTENT_REVIEW_MESSAGES[status]}</Typography>}
    {error && <Alert severity="warning">{error}</Alert>}
    <Button disabled={busy} onClick={() => void refresh()}>{busy ? 'Checking review…' : 'Refresh content review'}</Button>
  </Stack>
}
