import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import PageHeader from '@/components/PageHeader'
import { raisedSurface } from '@/lib/surfaces'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Link, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { Action, Resource } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

export interface ParkedEmail {
  id: string
  userId: string
  category: string
  title: string
  idempotencyKey: string
  firstAttemptAt?: string
  attempts: number
  lastError?: string
  occurredAt: string
}
interface Page { items: ParkedEmail[]; total: number }
const NOTE_MIN = 20

/**
 * Activity emails whose send stayed ambiguous past the provider's 24-hour
 * idempotency window. Staff look the key up in the email provider's log and
 * record the outcome; a re-send is deliberately not offered.
 */
export default function ActivityEmailReviewPage() {
  const { can } = useAdminPermissions()
  const canResolve = can(Resource.SETTINGS, Action.UPDATE)
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
      setData(await api.get<Page>(`/admin/activity-deliveries?page=${page}&pageSize=${pageSize}`))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activity emails')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])
  useEffect(() => { void load() }, [load])

  async function resolve(item: ParkedEmail, action: 'delivered' | 'suppress') {
    const note = (notes[item.id] ?? '').trim()
    if (note.length < NOTE_MIN || busy) return
    setBusy(item.id); setError(''); setNotice('')
    try {
      await api.patch(`/admin/activity-deliveries/${encodeURIComponent(item.id)}`, { action, note })
      setNotice(action === 'delivered' ? 'Marked delivered.' : 'Email given up. It will not be sent.')
      window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the outcome')
    } finally {
      setBusy('')
    }
  }

  return <Stack spacing={3}>
    <PageHeader title="Activity email checks" eyebrow="Platform" tone="teal" icon={<MarkEmailReadRoundedIcon />}
      lede="Opt-in activity emails whose delivery could not be confirmed within a day. Check each one in the email provider's log, then record what happened."
      stats={[{ label: 'Waiting for a check', value: loading ? <Skeleton width={60} /> : error ? '—' : data.total }]} />
    <ReviewQueueToolbar>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => void load()}>Refresh</Button>
    </ReviewQueueToolbar>
    <Alert severity="info">Search the email provider's log for the idempotency key. Mark the email delivered only if the log shows it was sent; otherwise give it up. Sending it again could deliver a duplicate, so this page cannot re-send.</Alert>
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    {loading && <ReviewQueueSkeleton label="Loading activity emails" />}
    {!loading && !error && !data.items.length && <ReviewQueueEmpty title="No activity emails need a check." description="Emails whose delivery could not be confirmed appear here." icon={<MarkEmailReadRoundedIcon />} />}
    {!loading && !error && data.items.map(item => {
      const note = notes[item.id] ?? ''
      const ready = canResolve && !busy && note.trim().length >= NOTE_MIN
      return <Paper key={item.id} component="article" aria-label={`Activity email: ${item.title}`} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">{item.title}</Typography>
          <Typography variant="body2">Idempotency key: <Box component="code">{item.idempotencyKey}</Box></Typography>
          <Typography variant="body2" color="text.secondary">
            {item.category} · first attempt {item.firstAttemptAt ? new Date(item.firstAttemptAt).toLocaleString() : 'not recorded'} · {item.attempts} attempt{item.attempts === 1 ? '' : 's'} · recipient <Link component={RouterLink} to={`/users/${item.userId}`}>account {item.userId}</Link>
          </Typography>
          <TextField multiline minRows={2} label={`What the provider log shows (at least ${NOTE_MIN} characters)`} value={note}
            disabled={!canResolve || !!busy} inputProps={{ maxLength: 2000 }}
            onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} />
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
            <Button variant="contained" disabled={!ready} onClick={() => void resolve(item, 'delivered')}>Mark delivered</Button>
            <Button color="warning" disabled={!ready} onClick={() => void resolve(item, 'suppress')}>Give up on this email</Button>
          </Stack>
        </Stack>
      </Paper>
    })}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
  </Stack>
}
