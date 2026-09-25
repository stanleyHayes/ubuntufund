import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import { ReviewQueueSkeleton, ReviewQueueEmpty } from '@/components/ReviewQueueStates'
import { raisedSurface } from '@/lib/surfaces'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { api } from '@/lib/api'

interface Restriction { userId: string; name?: string; email?: string; closed?: boolean; reason: string; restrictedBy: string; reportId?: string; restrictedAt: string }
const MIN_NOTES = 20

/**
 * Accounts whose publishing is currently restricted, with a direct restrict
 * form (no report needed) and an audited "lift" action. Restrictions keep
 * settings, privacy requests and financial access; campaigns are unaffected.
 */
export default function RestrictedUsersPanel() {
  const [items, setItems] = useState<Restriction[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(12)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [targetId, setTargetId] = useState(''), [targetNotes, setTargetNotes] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.get<{ items: Restriction[]; total: number }>(`/admin/safety-reports/restrictions?page=${page}&pageSize=${pageSize}`); setItems(data.items); setTotal(data.total); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load restricted accounts') }
    finally { setLoading(false) }
  }, [page, pageSize])
  useEffect(() => { void load() }, [load])
  async function run(key: string, work: () => Promise<unknown>, done: string) {
    setBusy(key); setError(''); setNotice('')
    try { await work(); setNotice(done); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this change') }
    finally { setBusy('') }
  }
  const validId = /^[a-f0-9]{24}$/i.test(targetId.trim())
  return <Stack spacing={2}>
    <Paper sx={{ ...raisedSurface, p: { xs: 2, sm: 3 } }}><Stack spacing={2}>
      <Typography variant="h6">Restrict an account</Typography>
      <Typography color="text.secondary">Use when a report is not the right record, for example repeated abuse across several items. The account keeps its settings, privacy requests and funds.</Typography>
      <TextField optionContext="safety" label="Account ID" value={targetId} onChange={e => setTargetId(e.target.value)} inputProps={{ maxLength: 24 }} />
      <TextField optionContext="safety" multiline minRows={2} label="Restriction notes (at least 20 characters)" value={targetNotes} onChange={e => setTargetNotes(e.target.value)} inputProps={{ maxLength: 2000 }} />
      <Box><Button variant="contained" disabled={!!busy || !validId || targetNotes.trim().length < MIN_NOTES}
        onClick={() => void run('new', () => api.post(`/admin/safety-reports/restrictions/${targetId.trim()}`, { notes: targetNotes.trim() }), 'Publishing restricted.').then(() => { setTargetId(''); setTargetNotes('') })}>Restrict publishing</Button></Box>
    </Stack></Paper>
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    {loading && <ReviewQueueSkeleton label="Loading restricted accounts" />}
    {!loading && !error && !items.length && <ReviewQueueEmpty title="No restricted accounts." description="Accounts whose publishing is restricted will appear here." icon={<BlockRoundedIcon />} />}
    {!loading && items.map(item => <Paper key={item.userId} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 } }}><Stack spacing={1.5}>
      <Box><Typography variant="h6">{item.name ?? 'Unknown account'}{item.closed ? ' (closed)' : ''}</Typography><Typography variant="caption">{item.email ?? item.userId} · restricted {new Date(item.restrictedAt).toLocaleString()}{item.reportId ? ` · report ${item.reportId}` : ' · direct restriction'}</Typography></Box>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.reason}</Typography>
      <TextField optionContext="safety" multiline minRows={2} label="Notes for lifting (at least 20 characters)" value={notes[item.userId] ?? ''} onChange={e => setNotes(current => ({ ...current, [item.userId]: e.target.value }))} inputProps={{ maxLength: 2000 }} />
      <Box><Button disabled={!!busy || (notes[item.userId] ?? '').trim().length < MIN_NOTES}
        onClick={() => void run(item.userId, () => api.post(`/admin/safety-reports/restrictions/${item.userId}/restore`, { notes: notes[item.userId].trim() }), 'Publishing restriction lifted. Previously hidden content stays hidden.')}>Lift restriction</Button></Box>
    </Stack></Paper>)}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
  </Stack>
}
