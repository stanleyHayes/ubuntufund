import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'
type Item = { _id: string; userId: string; kind: string; details: string; status: string; response: string; dueAt: string; revision: number }
function Review({ item, refresh }: { item: Item; refresh: () => Promise<void> }) {
  const [response, setResponse] = useState(''), [evidence, setEvidence] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('account'), [deliveryReference, setDeliveryReference] = useState('')
  const [events, setEvents] = useState<{ _id: string; action: string; actorId: string; evidence: string; createdAt: string; deliveryReference?: string }[]>([]), [eventPage, setEventPage] = useState(0), [eventTotal, setEventTotal] = useState(0)
  async function history() {
    setBusy(true); setError('')
    try { const data = await api.get<{ items: typeof events; total: number }>(`/admin/data-rights/${item._id}/events?page=${eventPage + 1}`); setEvents(previous => [...previous, ...data.items]); setEventTotal(data.total); setEventPage(previous => previous + 1) }
    catch { setError('Could not load review history.') }
    finally { setBusy(false) }
  }
  async function save(status: 'in_review' | 'responded') {
    setBusy(true); setError('')
    try { await api.put(`/admin/data-rights/${item._id}/review`, { revision: item.revision, status, evidence, response, deliveryMethod, deliveryReference }); await refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save review') }
    finally { setBusy(false) }
  }
  return <Stack spacing={2} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowWrap: 'anywhere' }}>
    <Typography fontWeight={700}>{item.kind} · {item.status.replace('_', ' ')}</Typography>
    <Typography variant="body2">Reference {item._id} · Account {item.userId} · Target {new Date(item.dueAt).toLocaleDateString()}</Typography>
    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.details}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {(eventPage === 0 || events.length < eventTotal) && <Button disabled={busy} onClick={() => void history()}>Load review history</Button>}
    {events.map(event => <Typography key={event._id} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{new Date(event.createdAt).toLocaleString()} · {event.action} · {event.actorId}{'\n'}{event.evidence}{event.deliveryReference && `\nDelivery evidence: ${event.deliveryReference}`}</Typography>)}
    {item.status === 'responded' ? <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.response}</Typography> : <>
      <TextField multiline minRows={3} label="Internal review evidence" value={evidence} onChange={e => setEvidence(e.target.value)} helperText="Record systems checked, corrections made, lawful exclusions and processor follow-up. This field is not shown to the requester. Do not paste credentials or identity documents." />
      <TextField multiline minRows={4} label="Response visible to requester" value={response} onChange={e => setResponse(e.target.value)} helperText="Include the requested information or explain what was corrected, any lawful exclusions and next steps. Acknowledgement alone is not a completed access response. Do not disclose another person's data or security secrets." />
      <TextField select label="Response delivery" value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)}><MenuItem value="account">Publish in account Settings</MenuItem><MenuItem value="verified_external">Record verified external delivery already completed</MenuItem></TextField>
      {deliveryMethod === 'verified_external' && <TextField multiline label="Identity verification and delivery reference" value={deliveryReference} onChange={e => setDeliveryReference(e.target.value)} helperText="Record the approved identity-verification method and completed secure-delivery receipt or case reference. This records your evidence; it does not send a message or verify delivery automatically." />}
      <Button disabled={busy || evidence.trim().length < 20} onClick={() => void save('in_review')}>Save review progress</Button>
      <Button variant="contained" disabled={busy || evidence.trim().length < 20 || response.trim().length < 20 || (deliveryMethod === 'verified_external' && deliveryReference.trim().length < 20)} onClick={() => void save('responded')}>{deliveryMethod === 'account' ? 'Publish response to requester' : 'Record completed external response'}</Button>
    </>}
  </Stack>
}
export function DataRightsQueue() {
  const [items, setItems] = useState<Item[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0), [status, setStatus] = useState('active'), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = await api.get<{ items: Item[]; total: number }>(`/admin/data-rights?page=${page}&status=${status}`); if (!Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('Invalid request response'); setItems(data.items); setTotal(data.total) }
    catch { setError('Could not load data-rights requests.') }
    finally { setLoading(false) }
  }, [page, status])
  useEffect(() => { void load() }, [load])
  return <Stack spacing={2}>
    <Typography variant="h5">Data access, corrections and complaints</Typography>
    <ExportMenu title="Data rights requests" disabled={loading || !!error} getReport={async progress => ({ title: "Data rights requests", filters: [`Status: ${status}`], tables: [exportTable("Data rights requests", await loadAll<Item>(`/admin/data-rights?status=${status}`, progress), { ID: r => r._id, Account: r => r.userId, Kind: r => r.kind, Status: r => r.status, "Due (UTC)": r => dateCell(r.dueAt), Details: r => r.details, Response: r => r.response })] })} />
    <Alert severity="info">The 30-day response target is an operational deadline. Review applicable legal timing, third-party rights and processor records. Responses appear in the account's Settings; closed-account requests need verified communication through the privacy team.</Alert>
    <TextField select label="Request status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><MenuItem value="active">Open and in review</MenuItem><MenuItem value="responded">Responded</MenuItem></TextField>
    <Button disabled={loading} onClick={() => void load()}>Refresh data requests</Button>
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {loading ? <Typography>Loading data-rights requests…</Typography> : items.map(item => <Review key={`${item._id}:${item.revision}`} item={item} refresh={load} />)}
    {!loading && !error && !items.length && <Typography>No requests in this view.</Typography>}
    <Stack direction="row" spacing={2}><Button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous data requests</Button><Typography>Page {page} · {total} requests</Typography><Button disabled={page * 25 >= total || loading} onClick={() => setPage(page + 1)}>More data requests</Button></Stack>
  </Stack>
}
