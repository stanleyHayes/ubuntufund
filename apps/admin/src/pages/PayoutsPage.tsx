import { PayoutTransferControls } from '@/components/PayoutTransferControls'
import { useSearchParams } from 'react-router-dom'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  TextField,
} from '@mui/material'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import type { BeneficiaryPayout, Payout, PayoutStatus } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import { TONES } from '@/lib/tones'
import PageHeader from '@/components/PageHeader'

const STATUS_TONE: Record<PayoutStatus, string> = {
  PENDING: TONES.gold.text,
  PROCESSING: TONES.teal.text,
  PAID: TONES.green.text,
  FAILED: TONES.clay.text,
  REVERSED: TONES.maroon.text,
  NEEDS_REVIEW: TONES.clay.text,
}

function money(n: number, currency = 'GHS'): string {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function PayoutCard({
  payout,
  onApprove,
  approving,
  onUpdated,
}: {
  payout: Payout
  onApprove: (id: string, reviewNote: string) => void
  approving: boolean
  onUpdated: () => void
}) {
  const [recipient, setRecipient] = useState<{
    accountName: string
    resolvedAccountName?: string
    accountNumber: string
    bankCode: string
    type: string
    verificationStatus: string
  } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState('')
  async function loadRecipient() {
    try {
      setRecipient(await api.get(`/payouts/${payout.id}/recipient`))
      setReviewError('')
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Could not load recipient')
    }
  }
  const needsReview = payout.status === 'NEEDS_REVIEW'
  const awaitingSecond = payout.status === 'PENDING' && Boolean(payout.firstApprovedBy)
  return (
    <Box
      sx={{
        ...raisedSurface,
        p: 3,
        borderLeft: needsReview ? `3px solid ${TONES.clay.text}` : undefined,
      }}
    >
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
            {money(payout.amount, payout.currency)}
          </Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
            {payout.campaignTitle ?? 'Campaign payout'} ·{' '}
            {payout.type.charAt(0).toUpperCase() + payout.type.slice(1)} ·{' '}
            {payout.provider === 'ujimora_wallet' ? 'Ujimora Wallet' : 'Bank / MoMo'}
          </Typography>
        </Box>
        <Chip
          label={
            payout.status === 'PROCESSING' && payout.providerStatus === 'otp'
              ? 'Awaiting Paystack authorization'
              : payout.status === 'PAID'
                ? 'Completed'
                : payout.status.replace('_', ' ').toLowerCase()
          }
          size="small"
          sx={{
            color: STATUS_TONE[payout.status],
            fontWeight: 700,
            bgcolor: 'transparent',
            border: `1px solid ${STATUS_TONE[payout.status]}`,
          }}
        />
      </Box>

      <Box
        sx={{
          ...insetSurface,
          px: 1.5,
          py: 1.5,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
        }}
      >
        <Detail label="Fee" value={money(payout.fee, payout.currency)} />
        <Detail label="Net" value={money(payout.netAmount, payout.currency)} />
        {payout.legs && payout.legs.length > 0 && (
          <Detail
            label="Legs"
            value={`${payout.legs.length} (${payout.legs.filter((l) => l.status === 'success').length} settled)`}
          />
        )}
        {payout.firstApprovedBy && (
          <Detail
            label="1st approval"
            value={payout.firstApprovedByName ?? 'Unavailable account'}
          />
        )}
        {payout.approvedBy && (
          <Detail label="Approved by" value={payout.approvedByName ?? 'Unavailable account'} />
        )}
      </Box>

      {payout.automationReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {payout.automationReason}
        </Typography>
      )}
      <PayoutTransferControls payout={payout} onUpdated={onUpdated} />
      {needsReview && (
        <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
          Partially settled — some transfer legs failed after others were sent. Manual
          reconciliation required.
        </Alert>
      )}
      {awaitingSecond && (
        <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
          Maker-checker: a first approval is recorded; a second, different admin must approve to
          disburse.
        </Alert>
      )}

      {payout.status === 'PENDING' && (
        <Box sx={{ mt: 2 }}>
          <Button onClick={() => void loadRecipient()}>Review payout destination</Button>
          {reviewError && <Alert severity="error">{reviewError}</Alert>}
          {recipient && (
            <>
              {payout.provider === 'ujimora_wallet' ? (
                <Alert severity="info">
                  Ujimora Wallet belonging to campaign owner {recipient.accountNumber}. Approval
                  credits the net amount internally; no bank or MoMo transfer is sent.
                </Alert>
              ) : (
                <Alert
                  severity={recipient.verificationStatus === 'name_matched' ? 'info' : 'warning'}
                >
                  Supplied name: {recipient.accountName}. Provider name:{' '}
                  {recipient.resolvedAccountName ?? 'Unresolved — obtain independent verification'}.
                  Account: {recipient.accountNumber} · {recipient.bankCode} · {recipient.type}. Name
                  matching alone does not prove ownership or receiving capacity.
                </Alert>
              )}
              <TextField
                fullWidth
                multiline
                minRows={3}
                sx={{ my: 2 }}
                label={
                  payout.provider === 'ujimora_wallet'
                    ? 'Owner and wallet transfer review'
                    : 'Beneficiary and capacity review'
                }
                helperText="Record evidence of ownership or beneficiary authorization and ability to receive the net payout. For MoMo, confirm wallet tier and available capacity with the owner. Do not enter PINs or identity document numbers."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </>
          )}
          <Button
            variant="contained"
            size="small"
            disabled={approving || !recipient || reviewNote.trim().length < 20}
            onClick={() => onApprove(payout.id, reviewNote)}
          >
            {approving ? 'Approving…' : awaitingSecond ? 'Give 2nd approval' : 'Approve'}
          </Button>
        </Box>
      )}
    </Box>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  )
}

function BeneficiaryCard({
  payout,
  onApprove,
  onVerifyKyc,
  busy,
}: {
  payout: BeneficiaryPayout
  onApprove: (id: string) => void
  onVerifyKyc: (campaignId: string, beneficiaryId: string) => void
  busy: boolean
}) {
  const awaitingSecond = payout.status === 'PENDING' && Boolean(payout.firstApprovedBy)
  return (
    <Box sx={{ ...raisedSurface, p: 3 }}>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
            {money(payout.amount, payout.currency)}
          </Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
            Beneficiary {payout.beneficiaryId} · campaign {payout.campaignId}
          </Typography>
        </Box>
        <Chip
          label={payout.status.replace('_', ' ')}
          size="small"
          sx={{
            color: STATUS_TONE[payout.status],
            fontWeight: 700,
            bgcolor: 'transparent',
            border: `1px solid ${STATUS_TONE[payout.status]}`,
          }}
        />
      </Box>
      <Box
        sx={{
          ...insetSurface,
          px: 1.5,
          py: 1.5,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
        }}
      >
        {payout.providerRef && <Detail label="Reference" value={payout.providerRef} />}
        {payout.firstApprovedBy && <Detail label="1st approval" value={payout.firstApprovedBy} />}
        {payout.approvedBy && <Detail label="Approved by" value={payout.approvedBy} />}
      </Box>
      {awaitingSecond && (
        <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
          Maker-checker: a first approval is recorded; a second, different admin must approve.
        </Alert>
      )}
      {payout.status === 'PENDING' && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            size="small"
            disabled={busy}
            onClick={() => onVerifyKyc(payout.campaignId, payout.beneficiaryId)}
          >
            Verify KYC
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={busy}
            onClick={() => onApprove(payout.id)}
          >
            {awaitingSecond ? 'Give 2nd approval' : 'Approve'}
          </Button>
        </Box>
      )}
    </Box>
  )
}

type View = 'queue' | 'all' | 'beneficiary'

export default function PayoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const view: View =
    requestedView === 'all' || requestedView === 'beneficiary' ? requestedView : 'queue'
  const setView = (value: View) => setSearchParams(value === 'queue' ? {} : { view: value })
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [benePayouts, setBenePayouts] = useState<BeneficiaryPayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const isBeneficiary = view === 'beneficiary'

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      setError(null)
      try {
        if (view === 'beneficiary') {
          const data = await api.get<BeneficiaryPayout[]>('/beneficiary-payouts/review-queue')
          setBenePayouts(Array.isArray(data) ? data : [])
        } else {
          const path = view === 'queue' ? '/payouts/review-queue' : '/payouts'
          const data = await api.get<Payout[]>(path)
          setPayouts(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payouts')
        setPayouts([])
        setBenePayouts([])
      } finally {
        setLoading(false)
      }
    },
    [view],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const update = () => {
      if (!document.hidden) void load(true)
    }
    const timer = setInterval(update, 30000)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [load])

  const approve = useCallback(
    async (id: string, reviewNote: string) => {
      setApprovingId(id)
      setNotice(null)
      try {
        const updated = await api.post<Payout>(`/payouts/${id}/approve`, { reviewNote })
        setNotice(
          updated.status === 'PENDING'
            ? 'First approval recorded — a second admin must approve.'
            : 'Payout approved; the transfer is initiating.',
        )
        await load()
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load],
  )

  const approveBeneficiary = useCallback(
    async (id: string) => {
      setApprovingId(id)
      setNotice(null)
      try {
        const updated = await api.post<BeneficiaryPayout>(`/beneficiary-payouts/${id}/approve`, {})
        setNotice(
          updated.status === 'PENDING'
            ? 'First approval recorded — a second admin must approve.'
            : 'Beneficiary payout approved; the transfer is initiating.',
        )
        await load()
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load],
  )

  const verifyKyc = useCallback(
    async (campaignId: string, beneficiaryId: string) => {
      setNotice(null)
      try {
        await api.post(
          `/campaigns/${campaignId}/split/beneficiaries/${beneficiaryId}/verify-kyc`,
          {},
        )
        setNotice('Beneficiary KYC verified.')
        await load()
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'KYC verification failed')
      }
    },
    [load],
  )

  const payoutPagination = usePagination(payouts, 12)
  const beneficiaryPagination = usePagination(benePayouts, 12)
  const source = isBeneficiary ? benePayouts : payouts
  const needsReview = source.filter((p) => p.status === 'NEEDS_REVIEW').length
  const pending = source.filter((p) => p.status === 'PENDING').length

  return (
    <Box>
      <PageHeader
        tone="teal"
        eyebrow="Payments"
        title="Payouts"
        lede="Approve and reconcile campaign payouts. High-value payouts need two admins; partially-settled batches are flagged for review."
        icon={<PaymentsRoundedIcon />}
        stats={[
          { label: 'Awaiting approval', value: pending },
          { label: 'Needs review', value: needsReview },
        ]}
      />

      <Box
        sx={{
          mt: 3,
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <ToggleButtonGroup
          aria-label="Payout views"
          sx={{
            gap: 1,
            flexWrap: 'wrap',
            '& .MuiToggleButtonGroup-grouped': {
              m: '0 !important',
              px: 2,
              py: 1.25,
              border: '0 !important',
              borderRadius: 'var(--shape-button, 10px) !important',
              bgcolor: 'var(--neu-surface)',
              boxShadow: 'var(--neu-subtle)',
              textTransform: 'none',
              '&.Mui-selected': {
                color: 'text.primary',
                bgcolor: 'action.selected',
                boxShadow: 'var(--neu-inset)',
              },
            },
          }}
          size="small"
          exclusive
          value={view}
          onChange={(_, v) =>
            v &&
            (setView(v as View), payoutPagination.goToPage(1), beneficiaryPagination.goToPage(1))
          }
        >
          <ToggleButton value="queue">Review queue</ToggleButton>
          <ToggleButton value="all">All payouts</ToggleButton>
          <ToggleButton value="beneficiary">Beneficiary</ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={140} />
          ))}
        </Stack>
      ) : error ? (
        <EmptyState
          title="Payouts couldn’t be loaded"
          description="The request failed. Retry to retrieve the latest payouts."
        />
      ) : source.length === 0 ? (
        <EmptyState
          title={view === 'all' ? 'No payouts yet' : 'Nothing needs attention'}
          description={
            isBeneficiary
              ? 'No beneficiary payouts are awaiting KYC, approval, or review.'
              : view === 'queue'
                ? 'No submitted cashout requests are awaiting review. Saving a payout account does not submit a cashout. The organizer must enter an amount and select Request cashout in the campaign’s Cashout & payout history section.'
                : 'Campaign payouts will appear here once organizers request them.'
          }
        />
      ) : isBeneficiary ? (
        <Stack spacing={2}>
          {beneficiaryPagination.page.map((p) => (
            <BeneficiaryCard
              key={p.id}
              payout={p}
              onApprove={approveBeneficiary}
              onVerifyKyc={verifyKyc}
              busy={approvingId === p.id}
            />
          ))}
        </Stack>
      ) : (
        <Stack spacing={2}>
          {payoutPagination.page.map((p) => (
            <PayoutCard
              key={p.id}
              payout={p}
              onApprove={approve}
              approving={approvingId === p.id}
              onUpdated={() => void load()}
            />
          ))}
        </Stack>
      )}
      {!loading && !error && source.length > 0 && (
        <PaginationBar
          neumorphic
          pagination={isBeneficiary ? beneficiaryPagination : payoutPagination}
        />
      )}
    </Box>
  )
}
