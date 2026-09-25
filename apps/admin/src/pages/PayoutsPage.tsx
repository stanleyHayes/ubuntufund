import ExportMenu from '@/components/ExportMenu'
import { exportTable, dateCell } from '@/lib/exports/report'
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
import type { BeneficiaryPayout, EscalatedPayout, Payout, PayoutStatus } from '@ubuntu-fund/types'
import { StuckPayoutResolve } from '@/components/StuckPayoutResolve'
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

const REJECTION_REASON_MIN = 20

/** Close a PENDING request with a reason the organizer will see. No transfer is ever sent. */
function PayoutRejectForm({
  payoutId,
  busy,
  onReject,
  helperText = `Shown to the organizer. At least ${REJECTION_REASON_MIN} characters. The cleared funds return to the campaign's pending balance; nothing is transferred.`,
}: {
  payoutId: string
  busy: boolean
  onReject: (id: string, reason: string) => void
  helperText?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open)
    return (
      <Button color="error" size="small" onClick={() => setOpen(true)} disabled={busy}>
        Reject request
      </Button>
    )
  return (
    <Box sx={{ mt: 2 }}>
      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Reason for rejection"
        helperText={helperText}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setOpen(false)} disabled={busy}>
          Keep request
        </Button>
        <Button
          size="small"
          color="error"
          variant="contained"
          disabled={busy || reason.trim().length < REJECTION_REASON_MIN}
          onClick={() => onReject(payoutId, reason.trim())}
        >
          {busy ? 'Rejecting…' : 'Reject payout'}
        </Button>
      </Box>
    </Box>
  )
}

function payoutStatusLabel(payout: Payout): string {
  if (payout.closure) return payout.closure.kind === 'rejected' ? 'Rejected' : 'Cancelled by organizer'
  if (payout.status === 'PROCESSING' && payout.providerStatus === 'otp')
    return 'Awaiting Paystack authorization'
  if (payout.status === 'PAID') return 'Completed'
  return payout.status.replace('_', ' ').toLowerCase()
}

function PayoutCard({
  payout,
  onApprove,
  onReject,
  approving,
  onUpdated,
}: {
  payout: Payout
  onApprove: (id: string, reviewNote: string) => void
  onReject: (id: string, reason: string) => void
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
          label={payoutStatusLabel(payout)}
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
        {payout.closure && (
          <Detail
            label={payout.closure.kind === 'rejected' ? 'Rejection reason' : 'Cancellation note'}
            value={payout.closure.reason}
          />
        )}
      </Box>

      {payout.automationReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {payout.automationReason}
        </Typography>
      )}
      <PayoutTransferControls payout={payout} onUpdated={onUpdated} />
      {needsReview && payout.legs && payout.legs.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
          Partially settled — some transfer legs failed after others were sent. Manual
          reconciliation required.
        </Alert>
      )}
      {needsReview && !payout.legs?.length && payout.provider === 'paystack' && (
        <StuckPayoutResolve rail="campaign" payoutId={payout.id} onUpdated={onUpdated} />
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
          <Box sx={{ mt: 1 }}>
            <PayoutRejectForm payoutId={payout.id} busy={approving} onReject={onReject} />
          </Box>
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

interface BeneficiaryDestination {
  type: string
  accountName: string
  accountNumber: string
  bankCode: string
  currency: string
  kycVerified: boolean
  kycVerifiedBy?: string
  kycVerifiedAt?: string
}

/**
 * Mirrors the campaign payout review: an approver must load and read the exact
 * destination, then record why it is safe to pay, before Verify KYC or Approve.
 */
function BeneficiaryCard({
  payout,
  onApprove,
  onReject,
  onVerifyKyc,
  onUpdated,
  busy,
}: {
  payout: BeneficiaryPayout
  onApprove: (id: string, reviewNote: string) => void
  onReject: (id: string, reason: string) => void
  onVerifyKyc: (campaignId: string, beneficiaryId: string) => Promise<void> | void
  onUpdated: () => void
  busy: boolean
}) {
  const awaitingSecond = payout.status === 'PENDING' && Boolean(payout.firstApprovedBy)
  const [destination, setDestination] = useState<BeneficiaryDestination | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState('')
  async function loadDestination() {
    try {
      setDestination(await api.get<BeneficiaryDestination>(`/beneficiary-payouts/${payout.id}/recipient`))
      setReviewError('')
    } catch (e) {
      setDestination(null)
      setReviewError(e instanceof Error ? e.message : 'Could not load the payout destination')
    }
  }
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
          label={
            payout.closure
              ? payout.closure.kind === 'rejected' ? 'Rejected' : 'Cancelled'
              : payout.status.replace('_', ' ')
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
        {payout.providerRef && <Detail label="Reference" value={payout.providerRef} />}
        {payout.firstApprovedBy && <Detail label="1st approval" value={payout.firstApprovedBy} />}
        {payout.approvedBy && <Detail label="Approved by" value={payout.approvedBy} />}
        {payout.closure && (
          <Detail
            label={payout.closure.kind === 'rejected' ? 'Rejection reason' : 'Cancellation note'}
            value={payout.closure.reason}
          />
        )}
      </Box>
      {awaitingSecond && (
        <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
          Maker-checker: a first approval is recorded; a second, different admin must approve.
        </Alert>
      )}
      {payout.status === 'NEEDS_REVIEW' && payout.providerRef && (
        <StuckPayoutResolve rail="beneficiary" payoutId={payout.id} onUpdated={onUpdated} />
      )}
      {payout.status === 'PENDING' && (
        <Box sx={{ mt: 2 }}>
          <Button onClick={() => void loadDestination()} disabled={busy}>Review payout destination</Button>
          {reviewError && <Alert severity="error">{reviewError}</Alert>}
          {destination && (
            <>
              <Alert severity={destination.kycVerified ? 'info' : 'warning'} sx={{ mt: 1 }}>
                {destination.type === 'mobile_money' ? 'Mobile money' : 'Bank'} account {destination.accountNumber} · {destination.bankCode} · name on request: {destination.accountName} · {destination.currency}.{' '}
                {destination.kycVerified
                  ? `KYC verified${destination.kycVerifiedAt ? ` ${new Date(destination.kycVerifiedAt).toLocaleString()}` : ''}. A changed destination resets verification.`
                  : 'KYC is not verified for this destination.'}{' '}
                The name on the request is not proof of ownership.
              </Alert>
              <TextField
                fullWidth
                multiline
                minRows={3}
                sx={{ my: 2 }}
                label="Beneficiary destination review"
                helperText="Record how you confirmed this beneficiary owns the destination and can receive the payout (at least 20 characters). Do not enter PINs or identity document numbers."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {destination && !destination.kycVerified && (
              <Button
                size="small"
                disabled={busy}
                onClick={async () => {
                  await onVerifyKyc(payout.campaignId, payout.beneficiaryId)
                  await loadDestination()
                }}
              >
                Verify KYC
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              disabled={busy || !destination?.kycVerified || reviewNote.trim().length < 20}
              onClick={() => onApprove(payout.id, reviewNote)}
            >
              {awaitingSecond ? 'Give 2nd approval' : 'Approve'}
            </Button>
          </Box>
          <Box sx={{ mt: 1 }}>
            <PayoutRejectForm
              payoutId={payout.id}
              busy={busy}
              onReject={onReject}
              helperText={`Shown to the beneficiary and campaign owner. At least ${REJECTION_REASON_MIN} characters. The cleared funds return to the beneficiary's pending balance; nothing is transferred.`}
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}

/** One escalated single transfer on any rail, resolved from Paystack's outcome. */
function EscalatedCard({ payout, onUpdated }: { payout: EscalatedPayout; onUpdated: () => void }) {
  const railLabel = { campaign: 'Campaign payout', beneficiary: 'Beneficiary payout', affiliate: 'Affiliate payout', creator: 'Creator withdrawal' }[payout.rail]
  return (
    <Box sx={{ ...raisedSurface, p: 3, borderLeft: `3px solid ${TONES.clay.text}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{money(payout.amount, payout.currency)}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>{railLabel}</Typography>
        </Box>
        <Chip
          label="needs review"
          size="small"
          sx={{ color: STATUS_TONE.NEEDS_REVIEW, fontWeight: 700, bgcolor: 'transparent', border: `1px solid ${STATUS_TONE.NEEDS_REVIEW}` }}
        />
      </Box>
      <Box sx={{ ...insetSurface, px: 1.5, py: 1.5, mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Detail label={payout.subjectLabel} value={payout.subject} />
        {payout.providerRef && <Detail label="Reference" value={payout.providerRef} />}
        <Detail label="Held since" value={new Date(payout.updatedAt).toLocaleString()} />
        <Detail label="Payout" value={payout.id} />
      </Box>
      <StuckPayoutResolve rail={payout.rail} payoutId={payout.id} onUpdated={onUpdated} />
    </Box>
  )
}

type View = 'queue' | 'all' | 'beneficiary' | 'escalated'

export default function PayoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const view: View =
    requestedView === 'all' || requestedView === 'beneficiary' || requestedView === 'escalated'
      ? requestedView
      : 'queue'
  const setView = (value: View) => setSearchParams(value === 'queue' ? {} : { view: value })
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [benePayouts, setBenePayouts] = useState<BeneficiaryPayout[]>([])
  const [escalated, setEscalated] = useState<EscalatedPayout[]>([])
  const [loading, setLoading] = useState(true)
  // `error` is only for a failed (foreground) load, which replaces the list.
  // Action failures and background-refresh failures keep the cards mounted,
  // so typed review notes, rejection reasons and loaded destinations survive.
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const isBeneficiary = view === 'beneficiary'
  const isEscalated = view === 'escalated'

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true)
        setError(null)
      }
      // Escalations on every rail (campaign, beneficiary, affiliate, creator)
      // are counted on every view so held funds are never only in a log line.
      void api
        .get<EscalatedPayout[]>('/payouts/stuck')
        .then((rows) => setEscalated(Array.isArray(rows) ? rows : []))
        .catch(() => { /* The count is advisory; the Escalated view reports errors. */ })
      try {
        if (view === 'beneficiary') {
          const data = await api.get<BeneficiaryPayout[]>('/beneficiary-payouts/review-queue')
          setBenePayouts(Array.isArray(data) ? data : [])
        } else if (view === 'escalated') {
          const data = await api.get<EscalatedPayout[]>('/payouts/stuck')
          setEscalated(Array.isArray(data) ? data : [])
        } else {
          const path = view === 'queue' ? '/payouts/review-queue' : '/payouts'
          const data = await api.get<Payout[]>(path)
          setPayouts(Array.isArray(data) ? data : [])
        }
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load payouts'
        if (quiet) {
          // Keep what is on screen (and anything typed into it); say it may be stale.
          setActionError(`Couldn’t refresh payouts (${message}). The list below may be out of date.`)
        } else {
          setError(message)
          setPayouts([])
          setBenePayouts([])
          if (view === 'escalated') setEscalated([])
        }
      } finally {
        if (!quiet) setLoading(false)
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
      setActionError(null)
      try {
        const updated = await api.post<Payout>(`/payouts/${id}/approve`, { reviewNote })
        setNotice(
          updated.status === 'PENDING'
            ? 'First approval recorded — a second admin must approve.'
            : 'Payout approved; the transfer is initiating.',
        )
        await load(true)
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Approval failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load],
  )

  const reject = useCallback(
    async (id: string, reason: string) => {
      setApprovingId(id)
      setNotice(null)
      setActionError(null)
      try {
        await api.post<Payout>(`/payouts/${id}/reject`, { reason })
        setNotice('Payout request rejected. The organizer can see the reason; no transfer was sent.')
        await load(true)
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Rejection failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load],
  )

  const approveBeneficiary = useCallback(
    async (id: string, reviewNote: string) => {
      setApprovingId(id)
      setNotice(null)
      setActionError(null)
      try {
        const updated = await api.post<BeneficiaryPayout>(`/beneficiary-payouts/${id}/approve`, { reviewNote })
        setNotice(
          updated.status === 'PENDING'
            ? 'First approval recorded — a second admin must approve.'
            : 'Beneficiary payout approved; the transfer is initiating.',
        )
        await load(true)
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Approval failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load],
  )

  const rejectBeneficiary = useCallback(
    async (id: string, reason: string) => {
      setApprovingId(id)
      setNotice(null)
      try {
        await api.post<BeneficiaryPayout>(`/beneficiary-payouts/${id}/reject`, { reason })
        setNotice('Beneficiary payout request rejected. The reason is recorded; no transfer was sent.')
        await load()
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Rejection failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load],
  )

  const verifyKyc = useCallback(
    async (campaignId: string, beneficiaryId: string) => {
      setNotice(null)
      setActionError(null)
      try {
        await api.post(
          `/campaigns/${campaignId}/split/beneficiaries/${beneficiaryId}/verify-kyc`,
          {},
        )
        setNotice('Beneficiary KYC verified.')
        // Quiet, so the card (its loaded destination and note) stays mounted.
        await load(true)
        window.dispatchEvent(new Event('ujimora:admin-actions-changed'))
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'KYC verification failed')
      }
    },
    [load],
  )

  const payoutPagination = usePagination(payouts, 12)
  const beneficiaryPagination = usePagination(benePayouts, 12)
  const escalatedPagination = usePagination(escalated, 12)
  const reviewable: { status: PayoutStatus }[] = isBeneficiary ? benePayouts : payouts
  const source: unknown[] = isEscalated ? escalated : reviewable
  const needsReview = isEscalated ? escalated.length : reviewable.filter((p) => p.status === 'NEEDS_REVIEW').length
  const pending = isEscalated ? 0 : reviewable.filter((p) => p.status === 'PENDING').length

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
          { label: 'Escalated (all rails)', value: escalated.length },
        ]}
      actions={<ExportMenu title="Payouts" disabled={loading || !!error} getReport={() => ({ title: 'Payouts', filters: [`View: ${view}`], tables: isBeneficiary ? [exportTable('Beneficiary payouts', benePayouts, { ID: r => r.id, Campaign: r => r.campaignId, Beneficiary: r => r.beneficiaryId, Amount: r => r.amount, Currency: r => r.currency, Status: r => r.status, Provider: r => r.provider, 'Created (UTC)': r => dateCell(r.createdAt) })] : [exportTable('Campaign payouts', payouts, { ID: r => r.id, Campaign: r => r.campaignTitle ?? r.campaignId, Gross: r => r.amount, Fee: r => r.fee, Net: r => r.netAmount, Currency: r => r.currency, Status: r => r.status, 'Created (UTC)': r => dateCell(r.createdAt) })] })} />}
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
            (setView(v as View),
            payoutPagination.goToPage(1),
            beneficiaryPagination.goToPage(1),
            escalatedPagination.goToPage(1))
          }
        >
          <ToggleButton value="queue">Review queue</ToggleButton>
          <ToggleButton value="all">All payouts</ToggleButton>
          <ToggleButton value="beneficiary">Beneficiary</ToggleButton>
          <ToggleButton value="escalated">Escalated</ToggleButton>
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
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>
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
            isEscalated
              ? 'No transfer on any rail is held for review.'
              : isBeneficiary
              ? 'No beneficiary payouts are awaiting KYC, approval, or review.'
              : view === 'queue'
                ? 'No submitted cashout requests are awaiting review. Saving a payout account does not submit a cashout. The organizer must enter an amount and select Request cashout in the campaign’s Cashout & payout history section.'
                : 'Campaign payouts will appear here once organizers request them.'
          }
        />
      ) : isEscalated ? (
        <Stack spacing={2}>
          {escalatedPagination.page.map((p) => (
            <EscalatedCard key={`${p.rail}:${p.id}`} payout={p} onUpdated={() => void load()} />
          ))}
        </Stack>
      ) : isBeneficiary ? (
        <Stack spacing={2}>
          {beneficiaryPagination.page.map((p) => (
            <BeneficiaryCard
              key={p.id}
              payout={p}
              onApprove={approveBeneficiary}
              onReject={rejectBeneficiary}
              onVerifyKyc={verifyKyc}
              onUpdated={() => void load()}
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
              onReject={reject}
              approving={approvingId === p.id}
              onUpdated={() => void load(true)}
            />
          ))}
        </Stack>
      )}
      {!loading && !error && source.length > 0 && (
        <PaginationBar
          neumorphic
          pagination={
            isEscalated ? escalatedPagination : isBeneficiary ? beneficiaryPagination : payoutPagination
          }
        />
      )}
    </Box>
  )
}
