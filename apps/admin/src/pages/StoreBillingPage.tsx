import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import PageHeader from '@/components/PageHeader'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { api } from '@/lib/api'
import { raisedSurface } from '@/lib/surfaces'

interface WorkItem {
  _id: string; store: string; userId?: string; productId?: string; periodEnd?: string;
  acknowledgementPending?: boolean; reviewRequired?: boolean; lastError?: string;
  nextCheckAt?: string; nextAttemptAt?: string; attempts?: number;
}
interface Queue { enabled: boolean; purchases: WorkItem[]; notifications: WorkItem[]; purchaseTotal: number; notificationTotal: number }

function Work({ item, kind, enabled, refresh }: { item: WorkItem; kind: 'purchase' | 'notification'; enabled: boolean; refresh: () => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [queued, setQueued] = useState(false)
  async function retry() {
    setBusy(true); setError(''); setQueued(false)
    try { await api.post(`/admin/store-billing/${kind}/${item._id}/retry`, { reason }); setQueued(true); setReason(''); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not queue verification.') }
    finally { setBusy(false) }
  }
  const next = item.nextCheckAt || item.nextAttemptAt
  return <Box sx={{ ...raisedSurface, p: 3, overflowWrap: 'anywhere' }}>
    <Stack spacing={2}>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}><Typography fontWeight={700}>{item.store === 'apple' ? 'App Store' : 'Google Play'} · {kind === 'purchase' ? 'Purchase' : 'Notification'}</Typography><Chip size="small" label={item.reviewRequired ? 'Review required' : item.acknowledgementPending ? 'Acknowledgement pending' : 'Verification pending'} /></Stack>
      {item.userId && <Typography variant="body2">Account: {item.userId} · Product: {item.productId}</Typography>}
      <Typography variant="body2">Work ID: {item._id}</Typography>
      {item.periodEnd && <Typography variant="body2">Last verified access ends {new Date(item.periodEnd).toLocaleString()}</Typography>}
      <Typography variant="body2">{item.lastError?.replaceAll('_', ' ') || 'Waiting for verification'}{next ? ` · Next attempt ${new Date(next).toLocaleString()}` : ''}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {queued && <Alert severity="success">Retry queued. The worker will verify the current store state; this does not grant access or resolve the issue.</Alert>}
      <TextField label="Reason for retry" multiline minRows={2} value={reason} onChange={event => setReason(event.target.value)} helperText="Record the configuration or support action taken. Do not include receipts, purchase tokens, keys or identity documents." slotProps={{ htmlInput: { maxLength: 1000 } }} />
      <Button variant="outlined" disabled={!enabled || busy || reason.trim().length < 10} onClick={() => void retry()}>{busy ? 'Queuing…' : 'Queue verification retry'}</Button>
    </Stack>
  </Box>
}

export default function StoreBillingPage() {
  const [queue, setQueue] = useState<Queue | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setQueue(await api.get<Queue>(`/admin/store-billing?page=${page}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load billing work.') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])
  return <Stack spacing={3}>
    <PageHeader title="Store billing recovery" eyebrow="Subscriptions" lede="Review pending verification and acknowledgement work from App Store and Google Play." icon={<WorkspacePremiumRoundedIcon />} tone="gold" stats={[{ label: "Purchase issues", value: loading ? <Skeleton width={60} /> : error ? "—" : queue?.purchaseTotal ?? 0 }, { label: "Pending notifications", value: loading ? <Skeleton width={60} /> : error ? "—" : queue?.notificationTotal ?? 0 }]} />
    <ReviewQueueToolbar>
      <Button disabled={loading} onClick={() => void load()}>Refresh queue</Button>
      <ExportMenu title="Store billing recovery" disabled={loading || !!error} getReport={async progress => {
      const purchases = await loadAll<WorkItem>('/admin/store-billing', progress, response => ({ items: (response as Queue).purchases, total: (response as Queue).purchaseTotal }))
      const notifications = await loadAll<WorkItem>('/admin/store-billing', progress, response => ({ items: (response as Queue).notifications, total: (response as Queue).notificationTotal }))
      return { title: 'Store billing recovery', filters: ['Pending verification and acknowledgement work'], tables: [
        exportTable('Purchase issues', purchases, { ID: r => r._id, Store: r => r.store, Account: r => r.userId, Product: r => r.productId, 'Review required': r => r.reviewRequired, 'Acknowledgement pending': r => r.acknowledgementPending, 'Period end (UTC)': r => dateCell(r.periodEnd), 'Next check (UTC)': r => dateCell(r.nextCheckAt) }),
        exportTable('Notifications', notifications, { ID: r => r._id, Store: r => r.store, Attempts: r => r.attempts, 'Review required': r => r.reviewRequired, 'Next attempt (UTC)': r => dateCell(r.nextAttemptAt) }),
      ] }
    }} />
    </ReviewQueueToolbar>
    <Alert severity="info">Receipts remain private. Correct store configuration or account issues before retrying. Ownership and access dates can only change after verified store evidence. Handle refunds in the responsible store.</Alert>
    {queue && !queue.enabled && <Alert severity="warning">Store billing is disabled. Configure it on the server before retrying this work.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}

    {loading ? <ReviewQueueSkeleton label="Loading store billing recovery" /> : queue && !error && <>
      <Typography>{queue.purchaseTotal} purchase issues · {queue.notificationTotal} pending notifications</Typography>
      {queue.purchases.map(item => <Work key={`purchase-${item._id}`} item={item} kind="purchase" enabled={queue.enabled} refresh={load} />)}
      {queue.notifications.map(item => <Work key={`notification-${item._id}`} item={item} kind="notification" enabled={queue.enabled} refresh={load} />)}
      {queue.purchaseTotal + queue.notificationTotal === 0 && <ReviewQueueEmpty title="No pending billing recovery work." description="Purchase verification and store notification issues will appear here when they need attention." icon={<WorkspacePremiumRoundedIcon />} />}
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} alignItems="center"><Button disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><Typography>Page {page}</Typography><Button disabled={loading || page * 25 >= Math.max(queue.purchaseTotal, queue.notificationTotal)} onClick={() => setPage(value => value + 1)}>Next</Button></Stack>
    </>}
  </Stack>
}
