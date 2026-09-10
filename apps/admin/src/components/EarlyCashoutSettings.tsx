import { useEffect, useState } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'
export function EarlyCashoutSettings({ canEdit }: { canEdit: boolean }) {
  const [percent, setPercent] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; api.get<{ resolved: { earlyFeePercent: number } }>('/admin/commercial-config').then(r => { if (active) setPercent(String(r.resolved.earlyFeePercent)) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  async function save() {
    setBusy(true); setError(''); setMessage('')
    try { await api.put('/admin/commercial-config/earlyFeePercent', { value: Number(percent), reason: 'Early cashout surcharge updated from platform settings' }); setMessage('Early cashout surcharge saved. New requests use this rate in addition to the plan fee already collected.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save surcharge.') }
    finally { setBusy(false) }
  }
  return <Box sx={{ p: 3, my: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
    <Typography variant="h6">Early cashout surcharge</Typography>
    <Typography variant="body2" sx={{ my: 2 }}>Before a campaign ends or reaches its goal, cashout requires an additional fee. The regular plan fee is already deducted from donations. Choosing standard cashout cannot bypass this surcharge.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    <TextField label="Additional early cashout (%)" type="number" value={percent} onChange={e => setPercent(e.target.value)} disabled={!canEdit || busy} slotProps={{ htmlInput: { min: 0, max: 100, step: 0.1 } }} />
    <Button onClick={() => void save()} disabled={!canEdit || busy || !percent || !Number.isFinite(Number(percent)) || Number(percent) < 0 || Number(percent) > 100}>Save surcharge</Button>
  </Box>
}
