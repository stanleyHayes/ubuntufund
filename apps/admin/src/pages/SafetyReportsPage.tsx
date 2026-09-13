import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Skeleton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'
interface Report { _id: string; targetType: 'user' | 'comment' | 'campaign_update' | 'live' | 'donation_message' | 'tip_message' | 'ai_output'; targetId: string; targetUserId?: string; reason: string; description?: string; evidence?: string; priority: string; createdAt: string; status: string; resolution?: string; reviewNotes?: string; reviewAction?: string }
export default function SafetyReportsPage() {
  const [pendingLiveCleanup, setPendingLiveCleanup] = useState(0)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Report[]>([]), [status, setStatus] = useState('pending'), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({}), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.get<{ items: Report[]; total: number; pendingLiveCleanup: number }>(`/admin/safety-reports?status=${status}&page=${page}`); setItems(data.items); setTotal(data.total); setPendingLiveCleanup(data.pendingLiveCleanup ?? 0); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load safety reports') }
    finally { setLoading(false) }
  }, [page, status])
  useEffect(() => { void load() }, [load])
  async function review(report: Report, action: string) {
    setBusy(report._id); setError(''); setNotice('')
    try {
      if (action === 'restore') await api.post(`/admin/safety-reports/restrictions/${report.targetUserId}/restore`, { notes: notes[report._id] || report.reviewNotes })
      else await api.put(`/admin/safety-reports/${report._id}/review`, { action, notes: notes[report._id] || report.reviewNotes })
      setNotice(action === 'restore' ? 'Publishing restriction removed. Previously hidden comments and messages remain hidden.' : 'Review saved.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save review') }
    finally { setBusy('') }
  }
  return <Stack spacing={3}>
    <Box><Typography variant="h4">Community safety reports</Typography>
    <ExportMenu title="Safety reports" disabled={loading || !!error} getReport={async progress => ({ title: "Safety reports", filters: [`Status: ${status}`], tables: [exportTable("Safety reports", await loadAll<Report>(`/admin/safety-reports?status=${status}`, progress), { ID: r => r._id, Type: r => r.targetType, Target: r => r.targetId, Reason: r => r.reason, Status: r => r.status, Resolution: r => r.resolution, Priority: r => r.priority, "Created (UTC)": r => dateCell(r.createdAt) })] })} /><Typography color="text.secondary">Review reported comments, donor/supporter messages, broadcasts and users. Urgent child-safety and credible-threat reports appear first. Publishing restrictions preserve account settings and financial access.</Typography></Box>
    {pendingLiveCleanup > 0 && <Alert severity="warning" action={<Button onClick={() => { void api.post('/admin/safety-reports/live-cleanup/retry', {}).then(load).catch(() => setError('Live cleanup retry failed.')) }}>Retry cleanup</Button>}>{pendingLiveCleanup} live safety operations still need provider cleanup. These are not complete.</Alert>}
    <Button onClick={() => void load()}>Refresh queue</Button>
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    <TextField select label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>{['pending', 'resolved', 'dismissed'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
    {loading && <Skeleton variant="rounded" height={180} />}
    {!loading && !items.length && <Typography>No reports in this queue.</Typography>}
    {items.map(report => <Paper key={report._id} sx={{ p: 3 }}><Stack spacing={2}>
      <Box><Chip label={report.priority} color={report.priority === 'urgent' ? 'error' : 'default'} /><Typography variant="h6">{report.targetType}: {report.reason.replaceAll('_', ' ')}</Typography><Typography variant="caption">Received {new Date(report.createdAt).toLocaleString()} · {report.targetUserId ? `User ${report.targetUserId}` : report.targetType === 'ai_output' ? 'AI-generated suggestion; review the model output' : 'Guest message; no verified account'}</Typography></Box>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.description}</Typography>
      <Box sx={{ p: 2, bgcolor: 'action.hover' }}><Typography variant="subtitle2">Reported content snapshot</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.evidence}</Typography></Box>
      {report.status === 'pending' && report.reviewAction && <Alert severity="info">Review started: {report.reviewAction.replaceAll('_', ' ')}. Retry that action to finish it. The original notes are preserved.</Alert>}
      {report.reviewNotes && <Typography>Previous review: {report.reviewNotes}</Typography>}
      <TextField multiline minRows={2} label="Review notes (at least 20 characters)" value={notes[report._id] ?? (report.status === 'pending' ? report.reviewNotes : '') ?? ''} disabled={report.status === 'pending' && !!report.reviewAction} onChange={e => setNotes(current => ({ ...current, [report._id]: e.target.value }))} inputProps={{ maxLength: 2000 }} />
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        {report.status === 'pending' ? <>
          {report.targetType === 'live' && <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'stop_live')}>End broadcast at provider</Button>}
          {report.targetType === 'comment' && <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'hide_comment')}>Hide comment</Button>}
          {report.targetType === 'campaign_update' && <Button disabled={!!busy || ((notes[report._id] || report.reviewNotes)?.trim().length || 0) < 20} onClick={() => void review(report, 'hide_update')}>Hide campaign update</Button>}
          {['donation_message', 'tip_message'].includes(report.targetType) && <Button disabled={!!busy || ((notes[report._id] || report.reviewNotes)?.trim().length || 0) < 20} onClick={() => void review(report, 'hide_message')}>Hide message</Button>}
          <Button disabled={!report.targetUserId || !!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'restrict_user')}>Restrict publishing</Button>
          <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'resolve')}>Resolve after other action</Button>
          <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'dismiss')}>Dismiss</Button>
        </> : report.resolution === 'restrict_user' && <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'restore')}>Restore publishing after appeal</Button>}
      </Stack>
    </Stack></Paper>)}
    <Stack direction="row" spacing={2}><Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Typography>{total} reports · Page {page}</Typography><Button disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</Button></Stack>
  </Stack>
}
