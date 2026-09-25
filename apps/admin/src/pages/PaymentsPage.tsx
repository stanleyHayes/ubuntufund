import TextField from '@/components/AdminTextField'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import PageHeader from '@/components/PageHeader'
import RefundDialog, { REFUNDABLE_STATUSES } from '@/components/payments/RefundDialog'
import { raisedSurface } from '@/lib/surfaces'
import { ReviewQueueEmpty, ReviewQueueSkeleton, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Chip, Link, MenuItem, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { Action, Resource } from '@ubuntu-fund/types'
import { formatCurrency } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

export interface AdminPayment {
  id: string
  campaignId: string
  donorEmail?: string
  donorName?: string
  amount: number
  currency: string
  tip: number
  status: string
  provider: string
  paymentMethod?: string
  providerRef?: string
  createdAt: string
  updatedAt: string
}
interface Attempt { id: string; provider: string; providerRef?: string; status: string; createdAt: string }
interface Timeline { contribution: AdminPayment; attempts: Attempt[] }

const STATUSES = ['CREATED', 'PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED', 'CHARGEBACK', 'FAILED', 'CANCELLED', 'EXPIRED']
const PROVIDERS = ['paystack', 'flutterwave', 'wallet', 'bitnob', 'yellowcard', 'paychant']
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase()

/**
 * Payment lookup for support and refunds: find a contribution by provider
 * reference, donor email, campaign or status (any state, not only settled
 * donations), inspect its attempt timeline and refund it with confirmation.
 */
export default function PaymentsPage() {
  const { can } = useAdminPermissions()
  const canRefund = can(Resource.DONATIONS, Action.UPDATE)
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState({ providerRef: params.get('ref') ?? '', donorEmail: '', campaignId: '', status: '', provider: '' })
  const [results, setResults] = useState<AdminPayment[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const selectedId = params.get('id')
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')
  const [refundOpen, setRefundOpen] = useState(0)

  const search = useCallback(async (criteria: typeof filters) => {
    setSearching(true); setError('')
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(criteria)) if (value.trim()) query.set(key, value.trim())
    const qs = query.toString()
    try { setResults(await api.get<AdminPayment[]>(`/admin/payments${qs ? `?${qs}` : ''}`)) }
    catch (e) { setResults(null); setError(e instanceof Error ? e.message : 'Could not search payments') }
    finally { setSearching(false) }
  }, [])

  const loadTimeline = useCallback(async (id: string) => {
    setTimelineLoading(true); setTimelineError('')
    try { setTimeline(await api.get<Timeline>(`/admin/payments/${encodeURIComponent(id)}`)) }
    catch (e) { setTimeline(null); setTimelineError(e instanceof Error ? e.message : 'Could not load this payment') }
    finally { setTimelineLoading(false) }
  }, [])

  useEffect(() => { if (selectedId) void loadTimeline(selectedId); else setTimeline(null) }, [selectedId, loadTimeline])
  // A ?ref= deep link runs its lookup immediately.
  const initialRef = params.get('ref')
  useEffect(() => { if (initialRef) void search({ providerRef: initialRef, donorEmail: '', campaignId: '', status: '', provider: '' }) }, [initialRef, search])

  function submit(event: FormEvent) {
    event.preventDefault()
    void search(filters)
  }
  const open = (id: string) => setParams(current => { const next = new URLSearchParams(current); next.set('id', id); return next })
  const set = (key: keyof typeof filters) => (event: { target: { value: string } }) => setFilters(current => ({ ...current, [key]: event.target.value }))
  const payment = timeline?.contribution

  return <Stack spacing={3}>
    <PageHeader title="Payments" eyebrow="Donations" tone="gold" icon={<ReceiptLongRoundedIcon />}
      lede="Look up any contribution, including pending and failed ones, follow its payment attempts and refund it when approved." />
    <ReviewQueueToolbar>
      <Box component="form" onSubmit={submit} aria-label="Search payments" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: '100%', alignItems: 'center' }}>
        <TextField label="Provider reference" value={filters.providerRef} onChange={set('providerRef')} />
        <TextField label="Donor email (exact)" value={filters.donorEmail} onChange={set('donorEmail')} />
        <TextField label="Campaign ID" value={filters.campaignId} onChange={set('campaignId')} />
        <TextField select label="Status" value={filters.status} onChange={set('status')} sx={{ minWidth: 160 }}>
          <MenuItem value="">Any status</MenuItem>
          {STATUSES.map(value => <MenuItem key={value} value={value}>{label(value)}</MenuItem>)}
        </TextField>
        <TextField select label="Provider" value={filters.provider} onChange={set('provider')} sx={{ minWidth: 140 }}>
          <MenuItem value="">Any provider</MenuItem>
          {PROVIDERS.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </TextField>
        <Button type="submit" variant="contained" startIcon={<SearchRoundedIcon />} disabled={searching}>{searching ? 'Searching…' : 'Search payments'}</Button>
      </Box>
    </ReviewQueueToolbar>
    {error && <Alert severity="error">{error}</Alert>}
    {searching && <ReviewQueueSkeleton label="Searching payments" />}
    {!searching && results && !results.length && <ReviewQueueEmpty title="No payments match." description="Check the reference or email is exact. Only the 50 most recent matches are shown." icon={<ReceiptLongRoundedIcon />} />}
    {!searching && !!results?.length && <Paper sx={{ ...raisedSurface, p: { xs: 1, sm: 2 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 1 }}>{results.length} most recent matches</Typography>
      <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
        {results.map(item => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ p: 1, overflowWrap: 'anywhere' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700}>{formatCurrency(item.amount, item.currency)} <Chip size="small" label={label(item.status)} sx={{ ml: 1 }} /></Typography>
            <Typography variant="body2" color="text.secondary">{new Date(item.createdAt).toLocaleString()} · {item.provider}{item.providerRef ? ` · ${item.providerRef}` : ''}{item.donorEmail ? ` · ${item.donorEmail}` : ''}</Typography>
          </Box>
          <Button size="small" variant={selectedId === item.id ? 'contained' : 'outlined'} onClick={() => open(item.id)}>View timeline</Button>
        </Stack>)}
      </Stack>
    </Paper>}

    {selectedId && <Paper component="section" aria-label="Payment timeline" sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
      {timelineLoading ? <Skeleton variant="rounded" height={160} /> : timelineError ? <Alert severity="error" action={<Button onClick={() => void loadTimeline(selectedId)}>Retry</Button>}>{timelineError}</Alert> : payment && <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{formatCurrency(payment.amount, payment.currency)}{payment.tip ? ` + ${formatCurrency(payment.tip, payment.currency)} platform tip` : ''}</Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" label={label(payment.status)} />
            <Chip size="small" variant="outlined" label={payment.provider} />
            {payment.paymentMethod && <Chip size="small" variant="outlined" label={label(payment.paymentMethod)} />}
          </Stack>
        </Box>
        <Typography variant="body2">Contribution {payment.id} · Reference {payment.providerRef || 'not issued'}</Typography>
        <Typography variant="body2">Campaign <Link component={RouterLink} to={`/campaigns/${payment.campaignId}`}>{payment.campaignId}</Link>{payment.donorEmail ? ` · ${payment.donorEmail}` : ' · Donor email not recorded'}{payment.donorName ? ` · ${payment.donorName}` : ''}</Typography>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Timeline</Typography>
          <Stack component="ol" spacing={1} sx={{ pl: 2.5, m: 0 }}>
            <li><Typography variant="body2">{new Date(payment.createdAt).toLocaleString()} · Contribution created</Typography></li>
            {[...timeline.attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(attempt => <li key={attempt.id}>
              <Typography variant="body2">{new Date(attempt.createdAt).toLocaleString()} · {attempt.provider} attempt {label(attempt.status)}{attempt.providerRef ? ` · ${attempt.providerRef}` : ''}</Typography>
            </li>)}
            <li><Typography variant="body2">{new Date(payment.updatedAt).toLocaleString()} · Last updated: {label(payment.status)}</Typography></li>
          </Stack>
          {!timeline.attempts.length && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No provider attempts were recorded.</Typography>}
        </Box>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
          {REFUNDABLE_STATUSES.includes(payment.status) && <Button color="error" variant="outlined" disabled={!canRefund} onClick={() => setRefundOpen(value => value + 1)}>Refund payment</Button>}
          <Button component={RouterLink} to="/refund-recovery">Refund recovery</Button>
        </Stack>
        {!REFUNDABLE_STATUSES.includes(payment.status) && <Typography variant="body2" color="text.secondary">Only a settled or partly refunded payment can be refunded.</Typography>}
      </Stack>}
    </Paper>}
    {payment && refundOpen > 0 && <RefundDialog key={`${payment.id}-${refundOpen}`} open contribution={payment}
      onClose={() => setRefundOpen(0)} onRefunded={() => void loadTimeline(payment.id)} />}
  </Stack>
}
