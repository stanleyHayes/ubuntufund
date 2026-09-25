import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

const NOTE_MIN = 20

/** GET /admin/users/:id/closure: what closing would strand (blocks it) or end. */
interface ClosurePreview {
  canClose: boolean
  openCampaigns: number
  /** Why closure is blocked, worded for staff. */
  message?: string
}

/**
 * Closes a member account for a holder who cannot sign in (they email
 * legal@). Uses the same erasure path as self-service deletion. Staff must
 * record how the request was verified and type the account email to confirm.
 * Never ask the requester for a password or one-time code.
 */
export default function AccountClosureControl({ userId, email, canClose }: { userId: string; email: string; canClose: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ClosurePreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const previewRequest = useRef<AbortController | null>(null)
  useEffect(() => () => previewRequest.current?.abort(), [])
  // Balances and in-flight payouts block closure for staff too; show them
  // before staff collect a note, and only enable closing once checked.
  const ready = preview?.canClose === true && note.trim().length >= NOTE_MIN && confirmEmail.trim().toLowerCase() === email.toLowerCase()

  async function openDialog() {
    setOpen(true); setPreview(null); setPreviewError(''); setError('')
    previewRequest.current?.abort()
    const controller = new AbortController()
    previewRequest.current = controller
    try {
      const result = await api.get<ClosurePreview>(`/admin/users/${encodeURIComponent(userId)}/closure`, { signal: controller.signal })
      if (!controller.signal.aborted) setPreview(result)
    } catch (e) {
      if (!controller.signal.aborted) setPreviewError(e instanceof Error ? e.message : 'Could not check this account’s balances.')
    }
  }

  async function close() {
    if (!ready || busy) return
    setBusy(true); setError('')
    try {
      await api.post(`/admin/users/${encodeURIComponent(userId)}/close`, { verificationNote: note.trim(), confirmEmail: confirmEmail.trim() })
      navigate('/users', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close the account.')
    } finally {
      setBusy(false)
    }
  }

  return <Box sx={{ p: 2.5 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      For account holders who cannot sign in and ask by email. Confirm the request came from the registered address; never ask for a password or code. Money records and verification evidence are kept.
    </Typography>
    <Button color="error" variant="outlined" disabled={!canClose} onClick={() => void openDialog()}>Close account</Button>
    <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="close-account-title">
      <DialogTitle id="close-account-title">Close this account</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {!preview && !previewError && <Typography variant="body2" color="text.secondary" role="status">Checking balances and payouts…</Typography>}
          {previewError && <Alert severity="error">{previewError}</Alert>}
          {preview && !preview.canClose && <Alert severity="error">{preview.message ?? 'This account still holds money and cannot be closed yet.'}</Alert>}
          {preview?.canClose && preview.openCampaigns > 0 && <Alert severity="info">Closing ends {preview.openCampaigns} open campaign{preview.openCampaigns === 1 ? '' : 's'}.</Alert>}
          <Alert severity="warning">This signs the member out everywhere and starts erasure of their profile data. It cannot be undone from the console.</Alert>
          <TextField label={`How the request was verified (at least ${NOTE_MIN} characters)`} multiline minRows={3} value={note} disabled={busy}
            onChange={event => setNote(event.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <TextField label="Type the account email to confirm" value={confirmEmail} disabled={busy} autoComplete="off"
            onChange={event => setConfirmEmail(event.target.value)} helperText={email} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button color="error" variant="contained" disabled={!ready || busy} onClick={() => void close()}>{busy ? 'Closing…' : 'Close account'}</Button>
      </DialogActions>
    </Dialog>
  </Box>
}
