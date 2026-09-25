import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import PageHeader from '@/components/PageHeader'
import { raisedSurface } from '@/lib/surfaces'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Skeleton, MenuItem, Paper, Stack, Typography } from '@mui/material'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/apiError'
import RestrictedUsersPanel from '@/components/RestrictedUsersPanel'
/** The restriction that governs an account now, from the API's 409 supersede refusal. */
interface Supersede { reportId: string; currentReportId: string; currentReason: string }
function supersedeFrom(error: unknown, reportId: string): Supersede | null {
  if (!(error instanceof ApiError) || error.status !== 409 || !error.errors?.supersede) return null
  return { reportId, currentReportId: error.errors.currentReportId?.[0] ?? '', currentReason: error.errors.currentReason?.[0] ?? '' }
}
interface Report { _id: string; targetType: 'user' | 'comment' | 'campaign_update' | 'live' | 'donation_message' | 'tip_message' | 'ai_output'; targetId: string; targetUserId?: string; reason: string; description?: string; evidence?: string; priority: string; createdAt: string; status: string; resolution?: string; reviewNotes?: string; reviewAction?: string }
export default function SafetyReportsPage() {
  const [pendingLiveCleanup, setPendingLiveCleanup] = useState(0)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Report[]>([]), [status, setStatus] = useState('pending'), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({}), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [pageSize, setPageSize] = useState(12)
  const [view, setView] = useState<'reports' | 'restrictions'>('reports')
  // A restore from an older report is refused (409) when a newer decision now
  // governs the account; staff may then lift that decision deliberately. Only
  // that specific refusal offers it, and any reload or other error clears it.
  const [supersede, setSupersede] = useState<Supersede | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setItems([]); setSupersede(null)
    try { const data = await api.get<{ items: Report[]; total: number; pendingLiveCleanup: number }>(`/admin/safety-reports?status=${status}&page=${page}&pageSize=${pageSize}`); setItems(data.items); setTotal(data.total); setPendingLiveCleanup(data.pendingLiveCleanup ?? 0); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load safety reports') }
    finally { setLoading(false) }
  }, [pageSize, page, status])
  useEffect(() => { void load() }, [load])
  async function review(report: Report, action: string) {
    setBusy(report._id); setError(''); setNotice('')
    try {
      const confirming = action === 'restore_supersede' && supersede?.reportId === report._id ? supersede : null
      if (action === 'restore_supersede' && !confirming) return
      if (action === 'restore' || confirming) await api.post(`/admin/safety-reports/restrictions/${report.targetUserId}/restore`, { notes: notes[report._id] || report.reviewNotes, reportId: report._id, ...(confirming ? { confirmSupersede: true, supersedeReportId: confirming.currentReportId } : {}) })
      else await api.put(`/admin/safety-reports/${report._id}/review`, { action, notes: notes[report._id] || report.reviewNotes })
      setSupersede(null)
      setNotice(action.startsWith('restore') ? 'Publishing restriction removed. Previously hidden comments and messages remain hidden.' : 'Review saved.'); await load()
    } catch (e) {
      // Offer the explicit lift only for the API's supersede refusal, never
      // for a network failure, a server error or a missing restriction.
      setSupersede(action.startsWith('restore') ? supersedeFrom(e, report._id) : null)
      setError(e instanceof Error ? e.message : 'Could not save review')
    }
    finally { setBusy('') }
  }
  return <Stack spacing={3}>
    <PageHeader title="Community safety reports" eyebrow="Trust & safety" lede="Review reported content and protect your community. Urgent reports appear first." tone="clay" icon={<ShieldRoundedIcon />} stats={[{ label: "Reports in this view", value: loading ? <Skeleton width={60} /> : error ? "—" : total }, { label: "Live cleanup pending", value: loading ? <Skeleton width={60} /> : error ? "—" : pendingLiveCleanup }]} />
    <Stack direction="row" spacing={1} role="group" aria-label="Safety view">
      <Button variant={view === 'reports' ? 'contained' : 'outlined'} aria-pressed={view === 'reports'} onClick={() => setView('reports')}>Reports</Button>
      <Button variant={view === 'restrictions' ? 'contained' : 'outlined'} aria-pressed={view === 'restrictions'} onClick={() => setView('restrictions')}>Restricted users</Button>
    </Stack>
    {view === 'restrictions' ? <RestrictedUsersPanel /> : <>
    <ReviewQueueToolbar>
      <TextField optionContext="safety" select sx={{ maxWidth: { sm: 280 } }} label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>{['pending', 'resolved', 'dismissed'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => void load()}>Refresh queue</Button>
      <ExportMenu title="Safety reports" disabled={loading || !!error} getReport={async progress => ({ title: "Safety reports", filters: [`Status: ${status}`], tables: [exportTable("Safety reports", await loadAll<Report>(`/admin/safety-reports?status=${status}`, progress), { ID: r => r._id, Type: r => r.targetType, Target: r => r.targetId, Reason: r => r.reason, Status: r => r.status, Resolution: r => r.resolution, Priority: r => r.priority, "Created (UTC)": r => dateCell(r.createdAt) })] })} />
    </ReviewQueueToolbar><Typography color="text.secondary">Review reported comments, donor/supporter messages, broadcasts and users. Urgent child-safety and credible-threat reports appear first. Publishing restrictions preserve account settings and financial access.</Typography>
    {pendingLiveCleanup > 0 && <Alert severity="warning" action={<Button onClick={() => { void api.post('/admin/safety-reports/live-cleanup/retry', {}).then(load).catch(() => setError('Live cleanup retry failed.')) }}>Retry cleanup</Button>}>{pendingLiveCleanup} live safety operations still need provider cleanup. These are not complete.</Alert>}

    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}

    {loading && <ReviewQueueSkeleton label="Loading safety reports" />}
    {!loading && !error && !items.length && <ReviewQueueEmpty title="No reports in this queue." description="Reports matching this status will appear here. Continue monitoring incoming reports and outstanding live cleanup." icon={<ShieldRoundedIcon />} />}
    {!loading && items.map(report => <Paper key={report._id} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 } }}><Stack spacing={2}>
      <Box><Chip label={report.priority} color={report.priority === 'urgent' ? 'error' : 'default'} /><Typography variant="h6">{report.targetType}: {report.reason.replaceAll('_', ' ')}</Typography><Typography variant="caption">Received {new Date(report.createdAt).toLocaleString()} · {report.targetUserId ? `User ${report.targetUserId}` : report.targetType === 'ai_output' ? 'AI-generated suggestion; review the model output' : 'Guest message; no verified account'}</Typography></Box>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.description}</Typography>
      <Box sx={{ p: 2, bgcolor: 'action.hover' }}><Typography variant="subtitle2">Reported content snapshot</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.evidence}</Typography></Box>
      {report.status === 'pending' && report.reviewAction && <Alert severity="info">Review started: {report.reviewAction.replaceAll('_', ' ')}. Retry that action to finish it. The original notes are preserved.</Alert>}
      {report.reviewNotes && <Typography>Previous review: {report.reviewNotes}</Typography>}
      <TextField optionContext="safety" multiline minRows={2} label="Review notes (at least 20 characters)" value={notes[report._id] ?? (report.status === 'pending' ? report.reviewNotes : '') ?? ''} disabled={report.status === 'pending' && !!report.reviewAction} onChange={e => setNotes(current => ({ ...current, [report._id]: e.target.value }))} inputProps={{ maxLength: 2000 }} />
      {supersede?.reportId === report._id && <Alert severity="warning">
        This account is now restricted under {supersede.currentReportId ? <>report <strong>{supersede.currentReportId}</strong></> : 'a direct staff restriction'}, not this report.
        {supersede.currentReason && <> Recorded reason: “{supersede.currentReason}”.</>} Review that decision first. Lifting it anyway removes that restriction.
      </Alert>}
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        {report.status === 'pending' ? <>
          {report.targetType === 'live' && <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'stop_live')}>End broadcast at provider</Button>}
          {report.targetType === 'comment' && <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'hide_comment')}>Hide comment</Button>}
          {report.targetType === 'campaign_update' && <Button disabled={!!busy || ((notes[report._id] || report.reviewNotes)?.trim().length || 0) < 20} onClick={() => void review(report, 'hide_update')}>Hide campaign update</Button>}
          {['donation_message', 'tip_message'].includes(report.targetType) && <Button disabled={!!busy || ((notes[report._id] || report.reviewNotes)?.trim().length || 0) < 20} onClick={() => void review(report, 'hide_message')}>Hide message</Button>}
          <Button disabled={!report.targetUserId || !!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'restrict_user')}>Restrict publishing</Button>
          <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'resolve')}>Resolve after other action</Button>
          <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'dismiss')}>Dismiss</Button>
        </> : report.resolution === 'restrict_user' && <>
          <Button disabled={!!busy || ((notes[report._id] || (report.status === 'pending' ? report.reviewNotes : ''))?.trim().length || 0) < 20} onClick={() => void review(report, 'restore')}>Restore publishing after appeal</Button>
          {supersede?.reportId === report._id && <Button color="warning" disabled={!!busy} onClick={() => void review(report, 'restore_supersede')}>Lift the current restriction anyway</Button>}
        </>}
      </Stack>
    </Stack></Paper>)}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
    </>}
  </Stack>
}
