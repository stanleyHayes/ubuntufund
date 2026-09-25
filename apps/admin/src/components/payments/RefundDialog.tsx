import TextField from '@/components/AdminTextField'
import { useCallback, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material'
import { formatMoney, fromMinorUnits, roundMoney } from '@/lib/money'
import { api } from '@/lib/api'

export interface RefundableContribution {
  id: string
  amount: number
  currency: string
  provider: string
  providerRef?: string
  status: string
  /** Already refunded, in the currency's minor units (from the API). */
  refundedAmountMinor?: number
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

/** What has been refunded already and what is left, in major units of the contribution currency. */
export function refundBalance(contribution: Pick<RefundableContribution, 'amount' | 'currency' | 'refundedAmountMinor'>): { refunded: number; remaining: number } {
  const refunded = fromMinorUnits(contribution.refundedAmountMinor ?? 0, contribution.currency)
  return { refunded, remaining: Math.max(0, roundMoney(contribution.amount - refunded, contribution.currency)) }
}

/** True when the contribution can still be refunded and has money left to refund. */
export function hasRefundableBalance(contribution: Pick<RefundableContribution, 'amount' | 'currency' | 'refundedAmountMinor' | 'status'>): boolean {
  return REFUNDABLE_STATUSES.includes(contribution.status) && refundBalance(contribution).remaining > 0
}

/**
 * Idempotency keys for refunds, held by the page rather than the dialog. A key
 * is tied to the contribution as the admin last saw it (id, status, amount
 * already refunded): closing and reopening the dialog after a lost response
 * reuses the same key, so the server refuses a second refund. A new key is
 * issued only once the page shows the contribution changed, i.e. the admin can
 * see what an earlier attempt did. Call it from event handlers, not render.
 */
export function useRefundKeys(): (contribution: RefundableContribution) => string {
  const keys = useRef(new Map<string, string>())
  return useCallback((contribution: RefundableContribution) => {
    const snapshot = `${contribution.id}:${contribution.status}:${contribution.refundedAmountMinor ?? 0}`
    let key = keys.current.get(snapshot)
    if (!key) { key = newIdempotencyKey(); keys.current.set(snapshot, key) }
    return key
  }, [])
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
 * The page passes the idempotency key (see useRefundKeys), so a double click,
 * a retry or a reopen after a lost response can never ask the provider for a
 * second refund. After a failure the page should reload the contribution
 * (`onClose(true)`) before offering another refund.
 */
export default function RefundDialog({ contribution, idempotencyKey, open, onClose, onRefunded }: {
  contribution: RefundableContribution
  idempotencyKey: string
  open: boolean
  /** `failed` is true when an attempt failed without a result, so the page should reload before another refund. */
  onClose: (failed: boolean) => void
  onRefunded: (result: RefundResult) => void
}) {
  const { refunded, remaining } = refundBalance(contribution)
  const [amount, setAmount] = useState(String(remaining))
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RefundResult | null>(null)

  const value = Number(amount)
  const validAmount = remaining > 0 && amount.trim() !== '' && Number.isFinite(value) && value > 0 && roundMoney(value, contribution.currency) <= remaining
  // Send the amount whenever it is not the untouched full contribution: after
  // an earlier partial refund the server's default (the full amount) is wrong.
  const explicitAmount = refunded > 0 || value < contribution.amount
  const close = () => onClose(!result && !!error)

  async function submit() {
    if (busy || result || !validAmount || !confirmed) return
    setBusy(true); setError('')
    try {
      const response = await api.post<RefundResult>(`/admin/payments/${encodeURIComponent(contribution.id)}/refund`, {
        ...(explicitAmount ? { amount: value } : {}),
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
  const helper = !validAmount
    ? remaining > 0 ? `Enter an amount above 0 and up to ${remaining}` : 'Nothing is left to refund on this contribution.'
    : roundMoney(value, contribution.currency) < remaining ? 'Partial refund'
      : refunded > 0 ? 'Remaining refundable amount' : 'Full campaign amount'
  return <Dialog open={open} onClose={busy ? undefined : close} fullWidth maxWidth="sm" aria-labelledby="refund-dialog-title">
    <DialogTitle id="refund-dialog-title">Refund contribution</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2">
          {formatMoney(contribution.amount, contribution.currency)} via {contribution.provider}
          {contribution.providerRef ? ` · reference ${contribution.providerRef}` : ''}
        </Typography>
        {refunded > 0 && <Typography variant="body2" fontWeight={600}>
          Already refunded {formatMoney(refunded, contribution.currency)} · {formatMoney(remaining, contribution.currency)} remaining
        </Typography>}
        <Alert severity="warning">This asks {contribution.provider} to return money to the donor and cannot be undone. Only the campaign amount is refunded; a separate platform tip is not. Funds already paid out to the campaign cannot be refunded here.</Alert>
        {outcome ? <Alert severity={outcome.severity}>{outcome.text}</Alert> : <>
          <TextField label={`Refund amount (${contribution.currency})`} type="number" value={amount} disabled={busy || remaining <= 0}
            onChange={event => setAmount(event.target.value)} error={amount !== '' && !validAmount}
            helperText={helper}
            slotProps={{ htmlInput: { min: 0, max: remaining, step: 'any' } }} />
          <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />}
            label="I have checked this refund is approved and the amount is correct." />
          {error && <Alert severity="error">{error} Retrying here reuses the same request, so it cannot refund the donor twice. Closing reloads the payment so you can see whether money already moved before you refund again.</Alert>}
        </>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={close} disabled={busy}>{result ? 'Close' : 'Cancel'}</Button>
      {!result && <Button variant="contained" color="error" disabled={busy || !validAmount || !confirmed} onClick={() => void submit()}>
        {busy ? 'Submitting refund…' : `Refund ${validAmount ? formatMoney(value, contribution.currency) : ''}`.trim()}
      </Button>}
    </DialogActions>
  </Dialog>
}
