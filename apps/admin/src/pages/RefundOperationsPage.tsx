import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Skeleton, Stack, TextField, Typography } from '@mui/material'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { Action, Resource } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'
import { raisedSurface } from '@/lib/surfaces'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

interface Operation {
  id: string; intentId: string; campaignId: string; provider: string;
  transactionReference: string; providerReference?: string; amount: number;
  currency: string; state: string; createdAt: string;
  fundsHoldVersion?: number;
}
interface Queue { items: Operation[]; total: number; page: number; pageSize: number }
const labels: Record<string, string> = {
  submitting: 'Outcome not yet confirmed', provider_unknown: 'Provider outcome unknown',
  provider_pending: 'Provider processing', provider_failed: 'Provider reported failure',
  reversal_pending: 'Accounting needs completion',
}

export default function RefundOperationsPage() {
  const { can } = useAdminPermissions()
  const [queue, setQueue] = useState<Queue | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [references, setReferences] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ text: string; complete: boolean } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setQueue(await api.get<Queue>(`/admin/refund-operations?page=${page}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load refund operations.') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])
  async function finish(id: string, verify = false, suppliedReference?: string) {
    setBusy(id); setError(''); setNotice(null)
    try {
      const result = await api.post<{ status: string }>(`/admin/refund-operations/${encodeURIComponent(id)}/${verify ? 'verify' : 'retry-accounting'}`, suppliedReference ? { providerReference: suppliedReference } : {})
      const complete = result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED'
      setNotice({ complete, text: complete ? 'Local accounting completed. No additional provider refund was requested.' : result.status === 'PROCESSING' ? 'The provider is still processing this refund. No replacement refund was requested.' : 'Accounting still needs review. The refund reservation remains in place.' })
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete accounting.') }
    finally { setBusy('') }
  }
  return <Stack spacing={3}>
    <PageHeader title="Refund recovery" eyebrow="Donations" lede="Review refunds with an unresolved provider outcome or unfinished accounting." icon={<PaymentsRoundedIcon />} />
    <ExportMenu title="Refund recovery" disabled={loading || !!error} getReport={async progress => ({ title: "Refund recovery", filters: ["Unresolved refund operations"], tables: [exportTable("Refund recovery", await loadAll<Operation>('/admin/refund-operations', progress), { ID: r => r.id, Campaign: r => r.campaignId, Provider: r => r.provider, "Provider reference": r => r.providerReference, Amount: r => r.amount, Currency: r => r.currency, State: r => r.state, "Created (UTC)": r => dateCell(r.createdAt) })] })} />
    <Alert severity="warning">Do not submit a replacement refund while its outcome is uncertain. Verify the original operation with the payment provider using the references below. A pending or failed response is not evidence that local accounting is complete.</Alert>
    {error && <Alert severity="error">{error}</Alert>}
    {notice && <Alert severity={notice.complete ? 'success' : 'warning'}>{notice.text}</Alert>}
    <Button disabled={loading || !!busy} onClick={() => void load()}>Refresh refunds</Button>
    {loading && !queue ? <Skeleton variant="rounded" height={240} /> : queue && !error && <>
      <Typography>{queue.total} unresolved refund operations</Typography>
      {queue.items.map(item => <Box key={item.id} sx={{ ...raisedSurface, p: 3, overflowWrap: 'anywhere' }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography fontWeight={700}>{new Intl.NumberFormat('en-GH', { style: 'currency', currency: item.currency }).format(item.amount)}</Typography>
            <Chip size="small" label={labels[item.state] || 'Review required'} />
          </Stack>
          <Typography variant="body2">{item.provider} · Started {new Date(item.createdAt).toLocaleString()}</Typography>
          <Typography variant="body2">Operation: {item.id}</Typography>
          <Typography variant="body2">Contribution: {item.intentId} · Campaign: {item.campaignId}</Typography>
          <Typography variant="body2">Payment reference: {item.transactionReference}</Typography>
          <Typography variant="body2">Provider refund reference: {item.providerReference || 'Not yet confirmed'}</Typography>
          <Typography variant="body2">{item.fundsHoldVersion === 1 ? 'Refund funds are held and unavailable for campaign or beneficiary payouts.' : 'Legacy operation: a funds hold is not recorded. Reconcile payout exposure before completion.'}</Typography>
          {item.state === 'reversal_pending' ? <>
            <Typography variant="body2">The provider reported this refund processed. Retry only the pending balance and ledger updates.</Typography>
            <Button variant="outlined" disabled={!!busy || !can(Resource.DONATIONS, Action.UPDATE)} onClick={() => void finish(item.id)}>{busy === item.id ? 'Completing accounting…' : 'Finish accounting'}</Button>
          </> : <>
            <Typography variant="body2">Verification checks the original provider record and can finish local accounting once processing is confirmed. This screen cannot resubmit or release the refund.</Typography>
            {!item.providerReference && <TextField label="Provider refund ID" value={references[item.id] || ''} onChange={event => setReferences(current => ({ ...current, [item.id]: event.target.value }))} disabled={!!busy} helperText="Find the original refund at the provider using the operation and payment references above." slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 30 } }} />}
            <Button variant="outlined" disabled={!!busy || !can(Resource.DONATIONS, Action.UPDATE) || (!item.providerReference && !/^\d{1,30}$/.test(references[item.id] || ''))} onClick={() => void finish(item.id, true, item.providerReference ? undefined : references[item.id])}>{busy === item.id ? 'Verifying…' : 'Verify provider status'}</Button>
          </>}
        </Stack>
      </Box>)}
      {queue.total === 0 && <Typography>No unresolved refund operations.</Typography>}
      <Stack direction="row" spacing={2} alignItems="center">
        <Button disabled={loading || !!busy || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
        <Typography>Page {page}</Typography>
        <Button disabled={loading || !!busy || page * queue.pageSize >= queue.total} onClick={() => setPage(value => value + 1)}>Next</Button>
      </Stack>
    </>}
  </Stack>
}
