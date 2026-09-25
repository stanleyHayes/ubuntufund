import { useState } from 'react'
import { Alert, Box, Button, TextField } from '@mui/material'
import type { EscalatedPayoutRail } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const RETURNS_TO: Record<EscalatedPayoutRail, string> = {
  campaign: 'the campaign',
  beneficiary: 'the beneficiary’s share',
  affiliate: 'the affiliate’s balance',
  creator: 'the creator’s balance',
}

/**
 * A single transfer Paystack could not confirm for a full day was escalated
 * with its funds still reserved. Resolving never picks an outcome: the API
 * re-checks Paystack and settles, returns or leaves it according to the answer.
 */
export function StuckPayoutResolve({
  rail,
  payoutId,
  onUpdated,
}: {
  rail: EscalatedPayoutRail
  payoutId: string
  onUpdated: () => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  async function resolve() {
    setBusy(true)
    setResult(null)
    try {
      const outcome = await api.post<{ providerOutcome: string; status: string }>(
        `/payouts/stuck/${rail}/${payoutId}/resolve`,
        { note: note.trim() },
      )
      setResult({
        ok: true,
        text: `Paystack reported ${outcome.providerOutcome}; the payout is now ${outcome.status.toLowerCase()}.`,
      })
      onUpdated()
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Could not resolve this payout' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity="warning" sx={{ py: 0.5 }}>
        Paystack has not confirmed this transfer for over a day, and the funds are still reserved.
        Resolving re-checks Paystack: a completed transfer is settled, a failed or unknown one
        returns the funds to {RETURNS_TO[rail]}, and one still in progress is left alone.
      </Alert>
      <TextField
        fullWidth
        multiline
        minRows={2}
        sx={{ mt: 1.5 }}
        label="What you checked"
        helperText="At least 20 characters, e.g. what the Paystack dashboard shows for this reference."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          variant="contained"
          disabled={busy || note.trim().length < 20}
          onClick={() => void resolve()}
        >
          {busy ? 'Checking Paystack…' : 'Re-check Paystack and resolve'}
        </Button>
      </Box>
      {result && (
        <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 1 }}>
          {result.text}
        </Alert>
      )}
    </Box>
  )
}
