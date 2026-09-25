import TextField from '@/components/AdminTextField'
import { useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material'
import { formatMoney } from '@/lib/money'
import { api } from '@/lib/api'

export interface RefundableContribution {
  id: string
  amount: number
  currency: string
  provider: string
  providerRef?: string
  status: string
}
export interface RefundResult {
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'PROCESSING' | 'PENDING_REVIEW'
  operationId: string
  refundReference?: string
  amount: number
}

export const REFUNDABLE_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED']

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function refundOutcome(result: RefundResult, currency: string): { severity: 'success' | 'warning'; text: string } {
  if (result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED') {
    return { severity: 'success', text: `Refund of ${formatMoney(result.amount, currency)} confirmed by the provider${result.refundReference ? ` (reference ${result.refundReference})` : ''}.` }
  }
  if (result.status === 'PROCESSING') {
    return { severity: 'warning', text: 'The provider is still processing this refund. Follow it in Refund recovery; do not submit it again.' }
  }
  return { severity: 'warning', text: 'The provider accepted the refund but local accounting needs review. Finish it in Refund recovery; do not submit it again.' }
}

/**
 * Confirmed refund of one contribution through POST /admin/payments/:id/refund.
 * Mount it fresh for each attempt (key it by contribution): it keeps one
 * idempotency key for its lifetime, so a double click or a retry after a lost
 * response can never ask the provider for a second refund.
 */
export default function RefundDialog({ contribution, open, onClose, onRefunded }: {
  contribution: RefundableContribution
  open: boolean
  onClose: () => void
  onRefunded: (result: RefundResult) => void
}) {
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [amount, setAmount] = useState(String(contribution.amount))
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RefundResult | null>(null)

  const value = Number(amount)
  const validAmount = amount.trim() !== '' && Number.isFinite(value) && value > 0 && value <= contribution.amount
  const partial = validAmount && value < contribution.amount

  async function submit() {
    if (busy || result || !validAmount || !confirmed) return
    setBusy(true); setError('')
    try {
      const response = await api.post<RefundResult>(`/admin/payments/${encodeURIComponent(contribution.id)}/refund`, {
        ...(partial ? { amount: value } : {}),
        idempotencyKey,
      })
      setResult(response)
      onRefunded(response)
      window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The refund could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  const outcome = result && refundOutcome(result, contribution.currency)
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="refund-dialog-title">
    <DialogTitle id="refund-dialog-title">Refund contribution</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2">
          {formatMoney(contribution.amount, contribution.currency)} via {contribution.provider}
          {contribution.providerRef ? ` · reference ${contribution.providerRef}` : ''}
        </Typography>
        <Alert severity="warning">This asks {contribution.provider} to return money to the donor and cannot be undone. Only the campaign amount is refunded; a separate platform tip is not. Funds already paid out to the campaign cannot be refunded here.</Alert>
        {outcome ? <Alert severity={outcome.severity}>{outcome.text}</Alert> : <>
          <TextField label={`Refund amount (${contribution.currency})`} type="number" value={amount} disabled={busy}
            onChange={event => setAmount(event.target.value)} error={amount !== '' && !validAmount}
            helperText={validAmount ? (partial ? 'Partial refund' : 'Full campaign amount') : `Enter an amount above 0 and up to ${contribution.amount}`}
            slotProps={{ htmlInput: { min: 0, max: contribution.amount, step: 'any' } }} />
          <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />}
            label="I have checked this refund is approved and the amount is correct." />
          {error && <Alert severity="error">{error} Retrying reuses this request, so the donor cannot be refunded twice.</Alert>}
        </>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>{result ? 'Close' : 'Cancel'}</Button>
      {!result && <Button variant="contained" color="error" disabled={busy || !validAmount || !confirmed} onClick={() => void submit()}>
        {busy ? 'Submitting refund…' : `Refund ${validAmount ? formatMoney(value, contribution.currency) : ''}`.trim()}
      </Button>}
    </DialogActions>
  </Dialog>
}
