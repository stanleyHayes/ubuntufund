import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import PageHeader from '@/components/PageHeader'
import ExportMenu from '@/components/ExportMenu'
import { ReviewQueueEmpty, ReviewQueueSkeleton, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import { loadAll } from '@/lib/exports/loadAll'
import { dateCell, exportTable } from '@/lib/exports/report'
import { insetSurface, raisedSurface } from '@/lib/surfaces'
import { TONES } from '@/lib/tones'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Chip, Link, MenuItem, Paper, Skeleton, Stack, Typography } from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ForwardToInboxRoundedIcon from '@mui/icons-material/ForwardToInboxRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import { Action, Resource, type DonorThankYouStatus, type DonorThankYouView } from '@ubuntu-fund/types'

/** `GET /admin/donor-thank-yous`: counts and message text only, never who received it. */
export type AdminDonorThankYou = DonorThankYouView & { campaignTitle: string }
interface Page { items: AdminDonorThankYou[]; total: number }

const STATUS_FILTERS: { value: 'all' | DonorThankYouStatus; label: string }[] = [
  { value: 'all', label: 'All messages' },
  { value: 'queued', label: 'Queued' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_sent', label: 'Partly sent' },
  { value: 'failed', label: 'Failed' },
]
const STATUS_LABELS: Record<DonorThankYouStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  partially_sent: 'Partly sent',
  failed: 'Failed',
}
const STATUS_TONES: Record<DonorThankYouStatus, string> = {
  draft: TONES.teal.text,
  queued: TONES.gold.text,
  sending: TONES.teal.text,
  sent: TONES.green.text,
  partially_sent: TONES.clay.text,
  failed: TONES.clay.text,
}
const AUTHOR_LABELS: Record<DonorThankYouView['authorRole'], string> = {
  manager: 'Organizer team',
  beneficiary: 'Beneficiary',
}

function when(value?: string): string {
  return value ? new Date(value).toLocaleString() : 'not recorded'
}

/** The API retries only finished messages; one still sending is left to the worker. */
function canRetry(item: AdminDonorThankYou): boolean {
  return item.retryableCount > 0 && (item.status === 'partially_sent' || item.status === 'failed')
}

/**
 * Delivery monitor for donor thank-you emails. Staff see progress counts and
 * the message, and can re-queue deliveries that failed with a temporary error.
 * Recipient identities never reach this page.
 */
export default function DonorThankYousPage() {
  const { can } = useAdminPermissions()
  const canUpdate = can(Resource.REPORTS, Action.UPDATE)
  const [status, setStatus] = useState<'all' | DonorThankYouStatus>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [reload, setReload] = useState(0)
  const [data, setData] = useState<Page>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get<Page>(`/admin/donor-thank-yous?status=${status}&page=${page}&pageSize=${pageSize}`)
      .then((result) => {
        if (!cancelled) setData({ items: Array.isArray(result?.items) ? result.items : [], total: Number(result?.total) || 0 })
      })
      .catch((e) => {
        if (cancelled) return
        setData({ items: [], total: 0 })
        setError(e instanceof Error ? e.message : 'Could not load thank-you messages.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, page, pageSize, reload])

  async function retry(item: AdminDonorThankYou) {
    if (busy || !canUpdate) return
    setBusy(item.id)
    setNotice('')
    setActionError('')
    try {
      const { requeued } = await api.post<{ requeued: number }>(`/admin/donor-thank-yous/${encodeURIComponent(item.id)}/retry`)
      setNotice(
        requeued > 0
          ? `${requeued} failed ${requeued === 1 ? 'delivery' : 'deliveries'} of the thank-you for “${item.campaignTitle}” will be sent again shortly.`
          : `Nothing from “${item.campaignTitle}” could be retried safely: the email provider may already have delivered those messages.`,
      )
      setReload((value) => value + 1)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not retry the failed deliveries.')
    } finally {
      setBusy('')
    }
  }

  const retryableOnPage = data.items.reduce((sum, item) => sum + (canRetry(item) ? item.retryableCount : 0), 0)

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Donor thank-yous"
        eyebrow="Trust & safety"
        tone="teal"
        icon={<ForwardToInboxRoundedIcon />}
        lede="Thank-you emails that organizers and beneficiaries send to everyone who gave. Follow delivery and retry temporary failures; recipients stay private."
        stats={[
          { label: 'Messages in this view', value: loading ? <Skeleton width={60} /> : error ? '—' : data.total },
          { label: 'Retryable on this page', value: loading ? <Skeleton width={60} /> : error ? '—' : retryableOnPage },
        ]}
      />
      <ReviewQueueToolbar>
        <TextField
          optionContext="thank-you"
          select
          sx={{ maxWidth: { sm: 320 } }}
          label="Delivery status"
          value={status}
          disabled={!!busy}
          onChange={(e) => {
            setStatus(e.target.value as 'all' | DonorThankYouStatus)
            setPage(1)
          }}
        >
          {STATUS_FILTERS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => setReload((value) => value + 1)}>
          Refresh
        </Button>
        <ExportMenu
          title="Donor thank-yous"
          disabled={loading || !!error}
          getReport={async (progress) => ({
            title: 'Donor thank-yous',
            filters: [`Status: ${STATUS_FILTERS.find((option) => option.value === status)?.label ?? status}`],
            tables: [
              exportTable('Donor thank-yous', await loadAll<AdminDonorThankYou>(`/admin/donor-thank-yous?status=${status}`, progress), {
                ID: (r) => r.id,
                Campaign: (r) => r.campaignTitle,
                'Campaign ID': (r) => r.campaignId,
                Author: (r) => AUTHOR_LABELS[r.authorRole] ?? r.authorRole,
                Status: (r) => STATUS_LABELS[r.status] ?? r.status,
                Recipients: (r) => r.recipientCount,
                Sent: (r) => r.sentCount,
                Skipped: (r) => r.skippedCount,
                Failed: (r) => r.failedCount,
                'Can retry': (r) => r.retryableCount,
                'Submitted (UTC)': (r) => dateCell(r.submittedAt),
                'Completed (UTC)': (r) => dateCell(r.completedAt),
                Subject: (r) => r.subject,
              }),
            ],
          })}
        />
      </ReviewQueueToolbar>
      <Alert severity="info">
        Only counts are shown: this page never says who received a message. Retrying sends again only deliveries that
        failed with a temporary error. Emails the provider may already have delivered are never repeated.
      </Alert>
      {error && (
        <Alert severity="error" action={<Button onClick={() => setReload((value) => value + 1)}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {loading && <ReviewQueueSkeleton label="Loading thank-you messages" />}
      {!loading && !error && !data.items.length && (
        <ReviewQueueEmpty
          title="No thank-you messages in this view."
          description="Messages appear here once an organizer or beneficiary sends one. Choose another status to see others."
          icon={<ForwardToInboxRoundedIcon />}
        />
      )}
      {!loading &&
        !error &&
        data.items.map((item) => {
          const tone = STATUS_TONES[item.status] ?? TONES.teal.text
          return (
            <Paper
              key={item.id}
              component="article"
              aria-label={`Thank-you message for ${item.campaignTitle}`}
              sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}
            >
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap gap={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                  <Link component={RouterLink} to={`/campaigns/${item.campaignId}`} variant="h6" underline="hover" sx={{ minWidth: 0 }}>
                    {item.campaignTitle}
                  </Link>
                  <Chip size="small" label={STATUS_LABELS[item.status] ?? item.status} sx={{ color: tone, bgcolor: `${tone}20`, fontWeight: 700 }} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Written by: {AUTHOR_LABELS[item.authorRole] ?? item.authorRole} · Submitted {when(item.submittedAt)} ·{' '}
                  {item.completedAt ? `Completed ${when(item.completedAt)}` : 'Not completed yet'}
                </Typography>
                <Typography variant="body2">Subject: {item.subject}</Typography>
                <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5, m: 0 }}>
                  {(
                    [
                      ['Recipients', item.recipientCount],
                      ['Sent', item.sentCount],
                      ['Skipped', item.skippedCount],
                      ['Failed', item.failedCount],
                      ['Can retry', item.retryableCount],
                    ] as const
                  ).map(([label, value]) => (
                    <Box key={label} sx={{ ...insetSurface, p: 1.5, minWidth: 0 }}>
                      <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
                      <Typography component="dd" sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</Typography>
                    </Box>
                  ))}
                </Box>
                <Box component="details">
                  <Typography component="summary" variant="body2" sx={{ cursor: 'pointer' }}>Message text</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{item.body}</Typography>
                  {item.signature && <Typography variant="body2" sx={{ mt: 1 }}>— {item.signature}</Typography>}
                </Box>
                {canRetry(item) ? (
                  <Box>
                    <Button
                      variant="contained"
                      startIcon={<ReplayRoundedIcon />}
                      disabled={!canUpdate || !!busy}
                      onClick={() => void retry(item)}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      {busy === item.id ? 'Retrying…' : 'Retry failed deliveries'}
                    </Button>
                  </Box>
                ) : (
                  item.retryableCount > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Failed deliveries can be retried once this message finishes sending.
                    </Typography>
                  )
                )}
              </Stack>
            </Paper>
          )
        })}
      {!loading && !error && (
        <ReviewQueuePagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={loading || !!busy}
        />
      )}
    </Stack>
  )
}
