import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import AssignmentReturnRoundedIcon from '@mui/icons-material/AssignmentReturnRounded'
import PageHeader from '@/components/PageHeader'
import RefundDialog, { hasRefundableBalance, refundBalance, useRefundKeys, type RefundResult, type RefundableContribution } from '@/components/payments/RefundDialog'
import { raisedSurface } from '@/lib/surfaces'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Chip, Link, MenuItem, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { Action, Resource } from '@ubuntu-fund/types'
import { formatMoney } from '@/lib/money'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed'
export interface RefundRequest {
  id: string
  donationId: string
  campaignId: string
  campaignTitle: string
  requesterId: string
  requesterName: string
  requesterEmail?: string
  reason: string
  description?: string
  amount: number
  netAmount: number
  currency: string
  status: RequestStatus
  staffNote?: string
  reviewedBy?: string
  reviewedAt?: string
  refundOperationId?: string
  createdAt: string
  /** The linked payment; `amount` is its own total and `refundedAmountMinor` what was already refunded (minor units). */
  contribution: { id: string; status: string; provider: string; providerRef?: string; currency: string; amount?: number; refundedAmountMinor?: number } | null
}
/** The payment as the refund dialog needs it; older APIs omit its own amount, so fall back to the request's. */
const refundable = (item: RefundRequest): RefundableContribution | null =>
  item.contribution ? { ...item.contribution, amount: item.contribution.amount ?? item.amount } : null
interface Page { items: RefundRequest[]; total: number }

const NOTE_MIN = 20
const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Awaiting review', processing: 'Processing', completed: 'Refunded', failed: 'Declined or failed',
}
const REFUNDED = ['REFUNDED', 'PARTIALLY_REFUNDED']

/**
 * Donor refund requests. Recording a status here never moves money: refund the
 * linked payment first (the dialog calls the admin refund endpoint), then mark
 * the request refunded. Every change needs a note and is audit-logged.
 */
export default function RefundRequestsPage() {
  const { can } = useAdminPermissions()
  const canUpdate = can(Resource.DONATIONS, Action.UPDATE)
  const [status, setStatus] = useState<RequestStatus>('pending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [data, setData] = useState<Page>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [operations, setOperations] = useState<Record<string, string>>({})
  // The refund key outlives the dialog, so reopening after a lost response reuses it.
  const refundKeyFor = useRefundKeys()
  const [refunding, setRefunding] = useState<{ item: RefundRequest; payment: RefundableContribution; key: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.get<Page>(`/admin/refund-requests?status=${status}&page=${page}&pageSize=${pageSize}`))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load refund requests')
    } finally {
      setLoading(false)
    }
  }, [status, page, pageSize])
  useEffect(() => { void load() }, [load])

  async function move(item: RefundRequest, next: Exclude<RequestStatus, 'pending'>) {
    const staffNote = (notes[item.id] ?? '').trim()
    if (staffNote.length < NOTE_MIN || busy) return
    setBusy(item.id); setError(''); setNotice('')
    try {
      await api.patch(`/admin/refund-requests/${encodeURIComponent(item.id)}`, {
        status: next, staffNote, ...(operations[item.id] ? { refundOperationId: operations[item.id] } : {}),
      })
      setNotice(`Request marked ${STATUS_LABELS[next].toLowerCase()}. The donor is notified of the new status.`)
      setNotes(current => { const copy = { ...current }; delete copy[item.id]; return copy })
      window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the request')
    } finally {
      setBusy('')
    }
  }

  function refunded(item: RefundRequest, result: RefundResult) {
    setOperations(current => ({ ...current, [item.id]: result.operationId }))
    void load()
  }

  return <Stack spacing={3}>
    <PageHeader title="Refund requests" eyebrow="Donations" tone="gold" icon={<AssignmentReturnRoundedIcon />}
      lede="Requests donors send from their donation history. Review each one, refund the payment if approved, and record the outcome."
      stats={[{ label: 'Requests in this view', value: loading ? <Skeleton width={60} /> : error ? '—' : data.total }]} />
    <ReviewQueueToolbar>
      <TextField select sx={{ maxWidth: { sm: 280 } }} label="Status" value={status} onChange={e => { setStatus(e.target.value as RequestStatus); setPage(1) }}>
        {(Object.keys(STATUS_LABELS) as RequestStatus[]).map(value => <MenuItem key={value} value={value}>{STATUS_LABELS[value]}</MenuItem>)}
      </TextField>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => void load()}>Refresh requests</Button>
    </ReviewQueueToolbar>
    <Alert severity="info">Changing a request's status does not move money. Refund the linked payment first; a request can be marked refunded only after its payment shows the refund. Declining notifies the donor.</Alert>
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}

    {loading && <ReviewQueueSkeleton label="Loading refund requests" />}
    {!loading && !error && !data.items.length && <ReviewQueueEmpty title="No refund requests in this queue." description="Requests donors send about their donations appear here." icon={<AssignmentReturnRoundedIcon />} />}
    {!loading && !error && data.items.map(item => {
      const note = notes[item.id] ?? ''
      const ready = canUpdate && !busy && note.trim().length >= NOTE_MIN
      const payment = item.contribution
      const refundPayment = refundable(item)
      const refundedSoFar = refundPayment ? refundBalance(refundPayment) : null
      const paymentRefunded = !!payment && REFUNDED.includes(payment.status)
      const open = item.status === 'pending' || item.status === 'processing'
      return <Paper key={item.id} component="article" aria-label={`Refund request from ${item.requesterName}`} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} alignItems="center">
              <Typography fontWeight={700}>{formatMoney(item.netAmount, item.currency)}</Typography>
              <Chip size="small" label={STATUS_LABELS[item.status]} />
              {payment && <Chip size="small" variant="outlined" label={`Payment ${payment.status.replaceAll('_', ' ').toLowerCase()}`} />}
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <Link component={RouterLink} to={`/users/${item.requesterId}`}>{item.requesterName}</Link>{item.requesterEmail ? ` · ${item.requesterEmail}` : ''} · <Link component={RouterLink} to={`/campaigns/${item.campaignId}`}>{item.campaignTitle}</Link>
            </Typography>
            <Typography variant="caption" color="text.secondary">Requested {new Date(item.createdAt).toLocaleString()} · Donation {item.donationId}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2">{item.reason}</Typography>
            {item.description && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Typography>}
          </Box>
          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
            {payment ? <>
              <Typography variant="body2">Payment {payment.id} via {payment.provider}{payment.providerRef ? ` · reference ${payment.providerRef}` : ''}</Typography>
              {!!refundedSoFar?.refunded && <Typography variant="body2">Refunded {formatMoney(refundedSoFar.refunded, payment.currency)} · {formatMoney(refundedSoFar.remaining, payment.currency)} still refundable</Typography>}
              <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" component={RouterLink} to={`/payments?id=${encodeURIComponent(payment.id)}`}>View payment timeline</Button>
                {open && refundPayment && hasRefundableBalance(refundPayment) && <Button size="small" color="error" variant="outlined" disabled={!canUpdate || !!busy} onClick={() => setRefunding({ item, payment: refundPayment, key: refundKeyFor(refundPayment) })}>Refund payment</Button>}
              </Stack>
            </> : <Typography variant="body2">No linked payment was found for this donation. It cannot be refunded or marked refunded here; escalate it to the payments team or decline it with a note.</Typography>}
          </Box>
          {item.staffNote && <Typography variant="body2">Last staff note{item.reviewedAt ? ` (${new Date(item.reviewedAt).toLocaleString()})` : ''}: {item.staffNote}</Typography>}
          {open && <>
            <TextField multiline minRows={2} label={`Staff note (at least ${NOTE_MIN} characters)`} value={note} disabled={!canUpdate || !!busy}
              inputProps={{ maxLength: 2000 }} helperText="Internal. Kept in the audit log; the donor sees only the status."
              onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} />
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
              {item.status === 'pending' && <Button variant="outlined" disabled={!ready} onClick={() => void move(item, 'processing')}>Approve and mark processing</Button>}
              <Button variant="contained" disabled={!ready || !paymentRefunded} onClick={() => void move(item, 'completed')}>Mark refunded</Button>
              <Button color="error" disabled={!ready} onClick={() => void move(item, 'failed')}>Decline</Button>
            </Stack>
          </>}
        </Stack>
      </Paper>
    })}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
    {refunding && <RefundDialog key={refunding.key} open contribution={refunding.payment} idempotencyKey={refunding.key}
      onClose={failed => { setRefunding(null); if (failed) void load() }} onRefunded={result => refunded(refunding.item, result)} />}
  </Stack>
}
