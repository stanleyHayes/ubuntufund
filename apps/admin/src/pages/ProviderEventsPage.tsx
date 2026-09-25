import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Chip, Link, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ReportGmailerrorredRoundedIcon from '@mui/icons-material/ReportGmailerrorredRounded'
import { Action, Resource } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import { api } from '@/lib/api'
import { raisedSurface } from '@/lib/surfaces'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

type Subject = 'donation' | 'tip' | 'subscription' | 'wallet_topup' | 'unknown'
type Filter = 'open' | 'acknowledged' | 'all'

export interface ProviderEvent {
  id: string
  event: string
  kind: 'dispute' | 'refund'
  reference?: string
  subject: Subject
  subjectId?: string
  campaignId?: string
  providerCaseId?: string
  amountMinor?: number
  currency?: string
  providerStatus?: string
  providerResolution?: string
  reviewStatus: 'open' | 'acknowledged'
  acknowledgedAt?: string
  createdAt: string
}

const SUBJECT_LABELS: Record<Subject, string> = {
  donation: 'Campaign donation',
  tip: 'Creator tip',
  subscription: 'Subscription',
  wallet_topup: 'Wallet top-up',
  unknown: 'Unknown reference',
}

/** What staff must do for each kind of charge. Nothing here moved a balance. */
const GUIDANCE: Record<Subject, string> = {
  donation: 'A case is open in Disputes and payouts for the campaign are paused. Record the provider reversal on that case. Do not refund from Payments: Paystack has already returned the money.',
  tip: "The creator's tip balance was not reduced. Check the creator's balance and escalate to finance before their next withdrawal.",
  subscription: 'A full refund removes the plan time this charge paid for automatically. A dispute does not change plan access, so review the member\'s plan.',
  wallet_topup: 'The wallet was not debited. Check the wallet balance and history. If the money was already donated or withdrawn, escalate to finance.',
  unknown: 'No Ujimora record matches this reference. Look it up in the Paystack dashboard.',
}

/** Minor units → major, at the currency's own precision (never a fixed 2dp). */
export function formatProviderAmount(amountMinor?: number, currency?: string): string {
  if (amountMinor === undefined || !currency) return 'Amount not reported'
  try {
    const format = new Intl.NumberFormat('en-GH', { style: 'currency', currency })
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2
    return format.format(amountMinor / 10 ** digits)
  } catch {
    return `${currency} ${amountMinor} (minor units)`
  }
}

export default function ProviderEventsPage() {
  const { can } = useAdminPermissions()
  const [filter, setFilter] = useState<Filter>('open')
  const [events, setEvents] = useState<ProviderEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const query = filter === 'all' ? '?limit=200' : `?status=${filter}&limit=200`
      setEvents(await api.get<ProviderEvent[]>(`/admin/payments/provider-events${query}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load provider events.')
    } finally {
      setLoading(false)
    }
  }, [filter])
  useEffect(() => { void load() }, [load])

  async function acknowledge(id: string) {
    setBusy(id); setError('')
    try {
      await api.post(`/admin/payments/provider-events/${encodeURIComponent(id)}/acknowledge`, {})
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not acknowledge this event.')
    } finally {
      setBusy('')
    }
  }

  const openCount = filter === 'open' && events ? events.length : undefined
  const canAcknowledge = can(Resource.DONATIONS, Action.UPDATE)

  return <Stack spacing={3}>
    <PageHeader
      title="Provider events"
      eyebrow="Donations"
      lede="Chargebacks and refunds Paystack reported that Ujimora did not start. Tips, subscriptions and wallet top-ups appear only here."
      icon={<ReportGmailerrorredRoundedIcon />}
      tone="gold"
      stats={[{ label: 'Open events', value: loading ? <Skeleton width={60} /> : error || openCount === undefined ? '—' : openCount }]}
    />
    <ReviewQueueToolbar title="Review tools" description="Filter events, then acknowledge each one once it is handled." icon={<ReportGmailerrorredRoundedIcon />}>
      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_event, value: Filter | null) => { if (value) setFilter(value) }} aria-label="Event status">
        <ToggleButton value="open">Open</ToggleButton>
        <ToggleButton value="acknowledged">Acknowledged</ToggleButton>
        <ToggleButton value="all">All</ToggleButton>
      </ToggleButtonGroup>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => void load()}>Refresh events</Button>
    </ReviewQueueToolbar>
    <Alert severity="warning">
      No balance was changed for these events. Never answer one with a console refund: the provider has already moved the money, so a refund would pay the customer twice.
    </Alert>
    {error && <Alert severity="error">{error}</Alert>}

    {loading ? <ReviewQueueSkeleton label="Loading provider events" /> : events && !error && <>
      {events.map((item) => <Box key={item.id} sx={{ ...raisedSurface, p: 3, overflowWrap: 'anywhere' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography fontWeight={700}>{formatProviderAmount(item.amountMinor, item.currency)}</Typography>
            <Chip size="small" color={item.kind === 'dispute' ? 'error' : 'warning'} label={item.kind === 'dispute' ? 'Chargeback / dispute' : 'Refund'} />
            <Chip size="small" label={SUBJECT_LABELS[item.subject] ?? item.subject} />
            {item.reviewStatus === 'acknowledged' && <Chip size="small" color="success" label="Acknowledged" />}
          </Stack>
          <Typography variant="body2">{item.event} · Received {new Date(item.createdAt).toLocaleString()}</Typography>
          <Typography variant="body2">Payment reference: {item.reference || 'Not reported'}</Typography>
          {item.providerCaseId && <Typography variant="body2">Provider case / refund ID: {item.providerCaseId}</Typography>}
          {(item.providerStatus || item.providerResolution) && (
            <Typography variant="body2">Provider status: {[item.providerStatus, item.providerResolution].filter(Boolean).join(' · ')}</Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {GUIDANCE[item.subject] ?? GUIDANCE.unknown}
            {item.subject === 'donation' && <> <Link component={RouterLink} to="/disputes">Open Disputes</Link>.</>}
          </Typography>
          {item.reviewStatus === 'open' && (
            <Box>
              <Button variant="outlined" disabled={!!busy || !canAcknowledge} onClick={() => void acknowledge(item.id)}>
                {busy === item.id ? 'Acknowledging…' : 'Mark handled'}
              </Button>
            </Box>
          )}
        </Stack>
      </Box>)}
      {events.length === 0 && <ReviewQueueEmpty
        title={filter === 'open' ? 'No open provider events.' : 'No provider events.'}
        description="Chargebacks and refunds that Paystack reports on its own will appear here."
        icon={<ReportGmailerrorredRoundedIcon />}
      />}
    </>}
  </Stack>
}
