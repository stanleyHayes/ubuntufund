import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { BrandedTextField } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

export function KYCRejectDialog({ id, reviewVersion, onClose, onSaved }: { id: string; reviewVersion: string; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (saving || reason.trim().length < 20) return
    setSaving(true); setError('')
    try {
      await api.put(`/kyc/${id}/reject`, { reviewVersion, rejectionReason: reason.trim() })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the decision. Please retry.') }
    finally { setSaving(false) }
  }
  return <Dialog open onClose={() => { if (!saving) onClose() }} maxWidth="sm" fullWidth aria-labelledby="kyc-rejection-title">
    <DialogTitle id="kyc-rejection-title">Explain the verification decision</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 2 }}>This reason is visible to the applicant. Explain what needs correcting before a new submission. Keep internal review notes out of this message.</Typography>
      <BrandedTextField autoFocus fullWidth multiline minRows={3} label="Reason for the applicant" value={reason} disabled={saving} onChange={event => setReason(event.target.value)} inputProps={{ maxLength: 1000 }} helperText={`${reason.trim().length}/1000 characters (at least 20)`} />
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions>
      <Button disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving || reason.trim().length < 20} onClick={() => void save()}>{saving ? 'Saving…' : 'Save rejection'}</Button>
    </DialogActions>
  </Dialog>
}
