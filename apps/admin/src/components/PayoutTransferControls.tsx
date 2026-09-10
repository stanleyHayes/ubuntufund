import { useState } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import type { Payout } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
export function PayoutTransferControls({
  payout,
  onUpdated,
}: {
  payout: Payout
  onUpdated: () => void
}) {
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function run(action: 'refresh' | 'authorize' | 'resend') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.post(`/payouts/${payout.id}/transfer-control`, {
        action,
        ...(action === 'authorize' ? { otp } : {}),
      })
      setOtp('')
      setNotice(
        action === 'resend'
          ? 'A new OTP was requested from Paystack.'
          : 'Transfer status refreshed.',
      )
      onUpdated()
      window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update transfer.')
      onUpdated()
    } finally {
      setBusy(false)
    }
  }
  if (payout.provider !== 'paystack' || payout.legs?.length || !payout.providerRef) return null
  return (
    <Box sx={{ mt: 2 }}>
      <Box component="details" sx={{ overflowWrap: 'anywhere' }}>
        <Typography component="summary" variant="caption" sx={{ cursor: 'pointer' }}>
          Technical details
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
          Paystack reference · {payout.providerRef}
        </Typography>
        {payout.transferCode && (
          <Typography variant="caption">Transfer code · {payout.transferCode}</Typography>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {payout.status === 'PROCESSING' && payout.providerStatus === 'otp' && (
        <>
          <Alert severity="warning" sx={{ my: 2 }}>
            Awaiting Paystack authorization. Enter the business OTP, or complete this same transfer
            in Paystack. The recipient does not enter this code. If expired, refresh to reconcile
            before requesting again.
          </Alert>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Paystack OTP"
              value={otp}
              autoComplete="one-time-code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
            />
            <Button disabled={busy || otp.length !== 6} onClick={() => void run('authorize')}>
              Authorize existing transfer
            </Button>
            <Button disabled={busy} onClick={() => void run('resend')}>
              Resend OTP
            </Button>
          </Box>
        </>
      )}
      {payout.status === 'PROCESSING' && (
        <Button disabled={busy} onClick={() => void run('refresh')}>
          Check Paystack status
        </Button>
      )}
      {payout.status === 'FAILED' &&
        ['abandoned', 'blocked', 'rejected'].includes(payout.providerStatus ?? '') && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Paystack stopped this transfer ({payout.providerStatus}). The reserved amount is
            returned through reconciliation. Refresh the campaign balance before making a new
            request.
          </Alert>
        )}
    </Box>
  )
}
