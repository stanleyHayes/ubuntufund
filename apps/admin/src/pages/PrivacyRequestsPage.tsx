import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { ReviewQueueSkeleton, ReviewQueueEmpty } from '@/components/ReviewQueueStates'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { DataRightsQueue } from '@/components/DataRightsQueue'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material'
import PrivacyTipRoundedIcon from '@mui/icons-material/PrivacyTipRounded'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'
import { raisedSurface } from '@/lib/surfaces'
interface PrivacyRequest {
  _id: string; userId: string; contactEmail: string; status: string;
  requestedAt: string; coreRemovedAt?: string; mediaUrls: string[];
  reviewNotes: string; nextReviewAt: string;
}
function Review({ item, refresh }: { item: PrivacyRequest; refresh: () => Promise<void> }) {
  const [notes, setNotes] = useState(item.reviewNotes)
  const [reviewDate, setReviewDate] = useState(item.nextReviewAt.slice(0, 10))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true); setError('')
    try { await api.put(`/admin/privacy-requests/${item._id}/review`, { reviewNotes: notes, nextReviewAt: new Date(`${reviewDate}T23:59:59Z`).toISOString() }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save review') }
    finally { setSaving(false) }
  }
  return <Box sx={{ ...raisedSurface, p: 3, overflowWrap: 'anywhere' }}>
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}><Typography fontWeight={700}>{item.contactEmail}</Typography><Chip size="small" label={item.status === 'pending' ? 'Cleanup pending' : 'Retention / processor review required'} /></Stack>
    <Typography variant="body2">Requested {new Date(item.requestedAt).toLocaleString()} · Account {item.userId}</Typography>
    <Typography variant="body2" sx={{ my: 2 }}>{item.coreRemovedAt ? 'Operational profile data removed. Financial records, safety evidence and processor copies still require a documented decision.' : 'Retry pending cleanup before reviewing residual records.'}</Typography>
    {item.mediaUrls.length > 0 && <Typography variant="body2" sx={{ mb: 2 }}>Media requiring processor review: {item.mediaUrls.join(', ')}</Typography>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack spacing={2}>
      <TextField multiline minRows={3} label="Review evidence and next steps" value={notes} onChange={e => setNotes(e.target.value)} helperText="Record each retained category, including data-rights requests and review evidence, its lawful purpose, expiry/review date, processor deletion reference and communication with the account owner. Do not paste identity documents." />
      <TextField type="date" label="Next review date" slotProps={{ inputLabel: { shrink: true } }} value={reviewDate} onChange={e => setReviewDate(e.target.value)} />
      <Button variant="contained" disabled={saving || notes.trim().length < 20 || !reviewDate} onClick={() => { void save() }}>{saving ? 'Saving…' : 'Save review and follow-up date'}</Button>
    </Stack>
  </Box>
}
export default function PrivacyRequestsPage() {
  const [items, setItems] = useState<PrivacyRequest[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = await api.get<{ items: PrivacyRequest[]; total: number }>(`/admin/privacy-requests?page=${page}`); setItems(data.items); setTotal(data.total) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])
  async function retry() { setRetrying(true); try { await api.post('/admin/privacy-requests/retry'); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Retry failed') } finally { setRetrying(false) } }
  return <Stack spacing={3}>
    <PageHeader title="Privacy requests" eyebrow="Trust & safety" lede="Track account erasure, justified retention and service-provider follow-up." icon={<PrivacyTipRoundedIcon />} tone="teal" stats={[{ label: "Deletion & retention requests", value: loading ? <Skeleton width={60} /> : error ? "—" : total }]} />
    <DataRightsQueue />
    <Typography variant="h5">Account deletion and retention</Typography>
    <ExportMenu title="Account deletion and retention" disabled={loading || !!error} getReport={async progress => ({ title: "Account deletion and retention", filters: ["All deletion and retention requests"], tables: [exportTable("Account deletion and retention", await loadAll<PrivacyRequest>('/admin/privacy-requests', progress), { ID: r => r._id, Account: r => r.userId, Status: r => r.status, "Requested (UTC)": r => dateCell(r.requestedAt), "Profile cleanup (UTC)": r => dateCell(r.coreRemovedAt), "Next review (UTC)": r => dateCell(r.nextReviewAt), Notes: r => r.reviewNotes })] })} />
    <Alert severity="info">A completed profile cleanup does not certify full erasure. Review retained records, account balances, campaigns, provider copies and backup handling, and respond to the requester.</Alert>
    <Button sx={{ alignSelf: 'flex-start' }} variant="outlined" disabled={retrying || loading} onClick={() => { void retry() }}>{retrying ? 'Retrying…' : 'Retry pending cleanup'}</Button>
    {error && <Alert severity="error" action={<Button onClick={() => { void load() }}>Retry</Button>}>{error}</Alert>}
    {loading ? <ReviewQueueSkeleton label="Loading account deletion requests" /> : !error && items.length === 0 ? <ReviewQueueEmpty title="No account deletion requests." description="Account closure requests and retained-data follow-ups will appear here when they need attention." icon={<PrivacyTipRoundedIcon />} /> : !error && items.map(item => <Review key={item._id} item={item} refresh={load} />)}
    <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} alignItems="center"><Button disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Typography>Page {page} · {total} requests</Typography><Button disabled={loading || page * 25 >= total} onClick={() => setPage(page + 1)}>Next</Button></Stack>
  </Stack>
}
