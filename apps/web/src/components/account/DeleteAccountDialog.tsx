import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

/** GET /profile/closure-check: money that blocks closure and campaigns closure would end. */
export interface AccountClosureCheck {
  canClose: boolean
  message?: string
  openCampaigns: number
  blockers: { kind: string; currency?: string; amount?: number; count?: number }[]
}

/**
 * Account deletion needs the current password (and an authenticator or recovery
 * code when MFA is on), and is refused while balances or payouts are outstanding.
 * The API enforces both; this dialog explains them before the user commits.
 */
export function DeleteAccountDialog({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [check, setCheck] = useState<AccountClosureCheck | null>(null)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setPassword(''); setCode(''); setError(''); setCheck(null); setLoading(true)
    Promise.allSettled([
      api.get<AccountClosureCheck>('/profile/closure-check'),
      api.get<{ enabled?: boolean }>('/auth/mfa'),
    ]).then(([closure, mfa]) => {
      if (!active) return
      // If the preview is unavailable the API still enforces every rule on delete.
      if (closure.status === 'fulfilled') setCheck(closure.value)
      setMfaEnabled(mfa.status === 'fulfilled' && !!mfa.value?.enabled)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open])

  const blocked = check?.canClose === false
  const needsCode = mfaEnabled || /authenticator code/i.test(error)

  async function handleDelete() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    try {
      await api.delete('/profile', { password, ...(code.trim() ? { code: code.trim() } : {}) })
      onDeleted()
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      // A balance or payout that appeared since the preview: show the current reasons.
      if (status === 409) void api.get<AccountClosureCheck>('/profile/closure-check').then(setCheck).catch(() => {})
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const campaigns = check?.openCampaigns ?? 0
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete account</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>
            This immediately closes your account and signs you out. Your profile will no longer be available.
            Financial and safety records may be retained where required by law, fraud prevention, or an active dispute.
            An App Store or Google Play subscription is not cancelled automatically; cancel it in your Apple or Google Play subscription settings to stop renewal.
          </Typography>
          {loading && <Typography variant="body2" color="text.secondary">Checking your balances and campaigns…</Typography>}
          {blocked && check?.message && <Alert severity="error">{check.message}</Alert>}
          {!blocked && campaigns > 0 && (
            <Alert severity="warning">
              Closing your account ends your {campaigns === 1 ? 'open campaign' : `${campaigns} open campaigns`}. {campaigns === 1 ? 'It stops' : 'They stop'} accepting donations, and anything awaiting review is withdrawn.
            </Alert>
          )}
          {!blocked && !loading && (
            <>
              <TextField
                label="Current password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={busy}
                fullWidth
              />
              {needsCode && (
                <TextField
                  label="Authenticator or recovery code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  disabled={busy}
                  fullWidth
                />
              )}
            </>
          )}
          {error && error !== check?.message && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void handleDelete()}
          disabled={busy || loading || blocked || !password || (needsCode && code.trim().length < 6)}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
