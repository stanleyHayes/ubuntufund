import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'
type Item = { _id: string; kind: string; details: string; status: string; response: string; dueAt: string; createdAt: string }
const labels: Record<string, string> = { access: 'Access to my data', correction: 'Correct my data', complaint: 'Privacy complaint' }
export function DataRightsRequests() {
  const [items, setItems] = useState<Item[]>([]), [kind, setKind] = useState('access'), [details, setDetails] = useState('')
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.get<{ items: Item[]; total: number }>(`/data-rights?page=${page}`); if (!Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('Invalid request response'); setItems(data.items); setTotal(data.total); setError('') }
    catch { setError('Could not load privacy requests. Please retry.') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])
  async function submit() {
    setBusy(true); setError(''); setMessage('')
    try { await api.post('/data-rights', { kind, details }); setDetails(''); setMessage('Request received. Check this section for its response.'); if (page !== 1) setPage(1); else await load() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not submit your request.') }
    finally { setBusy(false) }
  }
  return <Stack spacing={2} sx={{ py: 2 }}>
    <Typography variant="h6">Your data and privacy requests</Typography>
    <Typography variant="body2">Ask for a copy of your personal data, a correction or a privacy review. We aim to respond within 30 days. You can check progress and read the response here. This does not close your account.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert role="status" severity="success">{message}</Alert>}
    <TextField select label="Request type" value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
    <TextField multiline minRows={3} label="What would you like us to review?" value={details} onChange={e => setDetails(e.target.value)} slotProps={{ htmlInput: { maxLength: 5000 } }} helperText="Describe the records or correction you need. Do not include passwords, payment card numbers or identity-document images." />
    <Button variant="outlined" disabled={busy || details.trim().length < 10} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit privacy request'}</Button>
    <Button disabled={loading || busy} onClick={() => void load()}>Refresh privacy requests</Button>
    {loading ? <Typography>Loading requests…</Typography> : items.map(item => <Stack key={item._id} spacing={1} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowWrap: 'anywhere' }}>
      <Typography fontWeight={700}>{labels[item.kind]} · {item.status.replace('_', ' ')}</Typography>
      <Typography variant="body2">Reference {item._id} · Response target {new Date(item.dueAt).toLocaleDateString()}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.details}</Typography>
      {item.response && <><Typography fontWeight={700}>Response</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.response}</Typography><Button onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `ujimora-privacy-request-${item._id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}>Download request and response</Button></>}
    </Stack>)}
    {!loading && !items.length && <Typography>No privacy requests yet.</Typography>}
    <Stack direction="row" spacing={2}><Button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous requests</Button><Button disabled={page * 10 >= total || loading} onClick={() => setPage(page + 1)}>More requests</Button></Stack>
    <Typography variant="body2">If you cannot access your account, contact <a href="mailto:legal@ujimora.com">legal@ujimora.com</a>. You may also raise a concern with the <a href="https://dpc.gov.gh/for-individuals/" target="_blank" rel="noreferrer">Ghana Data Protection Commission</a>.</Typography>
  </Stack>
}
