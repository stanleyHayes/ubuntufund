import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'
const reasons = ['harassment', 'hate', 'sexual_content', 'violence', 'child_safety', 'credible_threat', 'fraud', 'spam', 'other']
export function ReportContent({ userId, commentId, updateId, liveSessionId, donationId, tipId, aiOutput }: { userId?: string; commentId?: string; updateId?: string; liveSessionId?: string; donationId?: string; tipId?: string; aiOutput?: { requestId: string; text: string } }) {
  const [open, setOpen] = useState(false), [target, setTarget] = useState(aiOutput ? 'ai_output' : updateId ? 'campaign_update' : donationId ? 'donation_message' : tipId ? 'tip_message' : liveSessionId ? 'live' : commentId ? 'comment' : 'user'), [reason, setReason] = useState('harassment'), [description, setDescription] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false)
  async function submit() {
    setBusy(true); setError('')
    try { await api.post('/safety/reports', { targetType: target, ...(target === 'ai_output' ? { generatedText: aiOutput?.text } : {}), targetId: target === 'ai_output' ? aiOutput?.requestId : target === 'campaign_update' ? updateId : target === 'donation_message' ? donationId : target === 'tip_message' ? tipId : target === 'live' ? liveSessionId : target === 'comment' ? commentId : userId, reason, description }); setSent(true); setOpen(false); setDescription('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send your report. Please try again.') }
    finally { setBusy(false) }
  }
  return <>
    <Button size="small" onClick={() => { setOpen(true); setError('') }}>Report</Button>
    {sent && <Typography role="status" variant="caption">Report received for moderation review.</Typography>}
    <Dialog open={open} onClose={() => { if (!busy) setOpen(false) }} fullWidth maxWidth="sm"><DialogTitle>Report a safety concern</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
      <Typography variant="body2">Your report and the reported content will be saved for review by Ujimora moderators. Your identity is not shown to the reported user. If someone is in immediate danger, contact local emergency services.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {commentId && <TextField select label="Report about" value={target} onChange={e => setTarget(e.target.value)} disabled={busy}><MenuItem value="comment">This comment</MenuItem><MenuItem value="user">This user</MenuItem></TextField>}
      <TextField select label="Reason" value={reason} onChange={e => setReason(e.target.value)} disabled={busy}>{reasons.map(value => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</TextField>
      <TextField multiline minRows={3} label="What happened?" helperText="Use 10–2,000 characters. Share only details needed for this review." value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 2000 }} disabled={busy} />
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || description.trim().length < 10} onClick={() => void submit()}>{busy ? 'Sending…' : 'Send report'}</Button></DialogActions></Dialog>
  </>
}
