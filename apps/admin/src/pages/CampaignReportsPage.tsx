import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import PageHeader from '@/components/PageHeader'
import { raisedSurface } from '@/lib/surfaces'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Chip, Link, MenuItem, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { Action, Resource } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

type ReportStatus = 'pending' | 'reviewed' | 'dismissed'
export interface CampaignReport {
  id: string
  campaignId: string
  campaignTitle: string
  campaignStatus?: string
  reporterId: string
  reason: string
  description?: string
  status: ReportStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
}
interface Page { items: CampaignReport[]; total: number }

const NOTE_MIN = 20
const STATUSES: ReportStatus[] = ['pending', 'reviewed', 'dismissed']
const REASONS: Record<string, string> = {
  fraudulent: 'Fraud or scam',
  misleading: 'Misleading information',
  inappropriate_content: 'Inappropriate content',
  spam: 'Spam',
  illegal_activity: 'Illegal activity',
  other: 'Other',
}

/**
 * Supporter reports raised with the Report button on a campaign page. Recording
 * a decision here never changes the campaign: block or restrict it from the
 * campaign page, then note what was done.
 */
export default function CampaignReportsPage() {
  const { can } = useAdminPermissions()
  const canReview = can(Resource.REPORTS, Action.UPDATE)
  const [status, setStatus] = useState<ReportStatus>('pending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [data, setData] = useState<Page>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.get<Page>(`/reports?status=${status}&page=${page}&pageSize=${pageSize}`))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load campaign reports')
    } finally {
      setLoading(false)
    }
  }, [status, page, pageSize])
  useEffect(() => { void load() }, [load])

  async function decide(report: CampaignReport, decision: Exclude<ReportStatus, 'pending'>) {
    const note = (notes[report.id] ?? '').trim()
    if (note.length < NOTE_MIN || busy) return
    setBusy(report.id); setError(''); setNotice('')
    try {
      await api.put(`/reports/${encodeURIComponent(report.id)}/review`, { status: decision, notes: note })
      setNotice(decision === 'reviewed' ? 'Report marked reviewed.' : 'Report dismissed.')
      setNotes(current => { const next = { ...current }; delete next[report.id]; return next })
      window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the review')
    } finally {
      setBusy('')
    }
  }

  return <Stack spacing={3}>
    <PageHeader title="Campaign reports" eyebrow="Trust & safety" tone="clay" icon={<FlagRoundedIcon />}
      lede="Reports supporters send with the Report button on a campaign. Investigate each one and record your decision."
      stats={[{ label: 'Reports in this view', value: loading ? <Skeleton width={60} /> : error ? '—' : data.total }]} />
    <ReviewQueueToolbar>
      <TextField select sx={{ maxWidth: { sm: 280 } }} label="Status" value={status} onChange={e => { setStatus(e.target.value as ReportStatus); setPage(1) }}>
        {STATUSES.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => void load()}>Refresh reports</Button>
      <ExportMenu title="Campaign reports" disabled={loading || !!error} getReport={async progress => ({
        title: 'Campaign reports', filters: [`Status: ${status}`],
        tables: [exportTable('Campaign reports', await loadAll<CampaignReport>(`/reports?status=${status}`, progress), {
          ID: r => r.id, Campaign: r => r.campaignTitle, 'Campaign ID': r => r.campaignId, Reason: r => REASONS[r.reason] ?? r.reason,
          Status: r => r.status, Reporter: r => r.reporterId, 'Created (UTC)': r => dateCell(r.createdAt), 'Review notes': r => r.reviewNotes,
        })],
      })} />
    </ReviewQueueToolbar>
    <Alert severity="info">Marking a report reviewed or dismissed does not change the campaign. To stop a fraudulent campaign, open it and block it first, then record what you did here.</Alert>
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}

    {loading && <ReviewQueueSkeleton label="Loading campaign reports" />}
    {!loading && !error && !data.items.length && <ReviewQueueEmpty title="No campaign reports in this queue." description="Reports supporters send about campaigns appear here." icon={<FlagRoundedIcon />} />}
    {!loading && !error && data.items.map(report => {
      const note = notes[report.id] ?? ''
      const ready = note.trim().length >= NOTE_MIN
      return <Paper key={report.id} component="article" aria-label={`Report about ${report.campaignTitle}`} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} alignItems="center">
              <Chip size="small" label={REASONS[report.reason] ?? report.reason} color={report.reason === 'fraudulent' || report.reason === 'illegal_activity' ? 'error' : 'default'} />
              {report.campaignStatus && <Chip size="small" variant="outlined" label={`Campaign ${report.campaignStatus.replaceAll('_', ' ')}`} />}
            </Stack>
            <Typography variant="h6" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
              <Link component={RouterLink} to={`/campaigns/${report.campaignId}`}>{report.campaignTitle}</Link>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Received {new Date(report.createdAt).toLocaleString()} · Reporter <Link component={RouterLink} to={`/users/${report.reporterId}`}>{report.reporterId}</Link>
            </Typography>
          </Box>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.description || 'No details were given.'}</Typography>
          {report.status !== 'pending' && <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2">{report.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}{report.reviewedAt ? ` ${new Date(report.reviewedAt).toLocaleString()}` : ''}{report.reviewedBy ? ` by ${report.reviewedBy}` : ''}</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.reviewNotes || 'No review notes were recorded.'}</Typography>
          </Box>}
          {report.status === 'pending' && <>
            <TextField multiline minRows={2} label={`Review notes (at least ${NOTE_MIN} characters)`} value={note}
              disabled={!canReview || !!busy} inputProps={{ maxLength: 2000 }}
              helperText="Say what you checked and any action taken on the campaign."
              onChange={e => setNotes(current => ({ ...current, [report.id]: e.target.value }))} />
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
              <Button variant="contained" disabled={!canReview || !ready || !!busy} onClick={() => void decide(report, 'reviewed')}>{busy === report.id ? 'Saving…' : 'Mark reviewed'}</Button>
              <Button variant="outlined" disabled={!canReview || !ready || !!busy} onClick={() => void decide(report, 'dismissed')}>Dismiss</Button>
              <Button component={RouterLink} to={`/campaigns/${report.campaignId}`}>Open campaign</Button>
            </Stack>
          </>}
        </Stack>
      </Paper>
    })}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
  </Stack>
}
