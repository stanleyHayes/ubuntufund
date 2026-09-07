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
} from '@mui/material'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import type { Payout, PayoutStatus } from '@ubuntu-fund/types'
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
}: {
  payout: Payout
  onApprove: (id: string) => void
  approving: boolean
}) {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
            {money(payout.amount, payout.currency)}
          </Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
            Campaign {payout.campaignId} · {payout.type}
          </Typography>
        </Box>
        <Chip
          label={payout.status.replace('_', ' ')}
          size="small"
          sx={{ color: STATUS_TONE[payout.status], fontWeight: 700, bgcolor: 'transparent', border: `1px solid ${STATUS_TONE[payout.status]}` }}
        />
      </Box>

      <Box sx={{ ...insetSurface, px: 1.5, py: 1.5, mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Detail label="Fee" value={money(payout.fee, payout.currency)} />
        <Detail label="Net" value={money(payout.netAmount, payout.currency)} />
        {payout.providerRef && <Detail label="Reference" value={payout.providerRef} />}
        {payout.legs && payout.legs.length > 0 && (
          <Detail label="Legs" value={`${payout.legs.length} (${payout.legs.filter((l) => l.status === 'success').length} settled)`} />
        )}
        {payout.firstApprovedBy && <Detail label="1st approval" value={payout.firstApprovedBy} />}
        {payout.approvedBy && <Detail label="Approved by" value={payout.approvedBy} />}
      </Box>

      {needsReview && (
        <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
          Partially settled — some transfer legs failed after others were sent. Manual reconciliation required.
        </Alert>
      )}
      {awaitingSecond && (
        <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
          Maker-checker: a first approval is recorded; a second, different admin must approve to disburse.
        </Alert>
      )}

      {payout.status === 'PENDING' && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            disabled={approving}
            onClick={() => onApprove(payout.id)}
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
      <Typography sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  )
}

export default function PayoutsPage() {
  const [view, setView] = useState<'queue' | 'all'>('queue')
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const path = view === 'queue' ? '/payouts/review-queue' : '/payouts'
      const data = await api.get<Payout[]>(path)
      setPayouts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts')
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    void load()
  }, [load])

  const approve = useCallback(
    async (id: string) => {
      setApprovingId(id)
      setNotice(null)
      try {
        const updated = await api.post<Payout>(`/payouts/${id}/approve`, {})
        setNotice(
          updated.status === 'PENDING'
            ? 'First approval recorded — a second admin must approve.'
            : 'Payout approved; the transfer is initiating.'
        )
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed')
      } finally {
        setApprovingId(null)
      }
    },
    [load]
  )

  const needsReview = payouts.filter((p) => p.status === 'NEEDS_REVIEW').length
  const pending = payouts.filter((p) => p.status === 'PENDING').length

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

      <Box sx={{ mt: 3, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
        >
          <ToggleButton value="queue">Review queue</ToggleButton>
          <ToggleButton value="all">All payouts</ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={140} />
          ))}
        </Stack>
      ) : payouts.length === 0 ? (
        <EmptyState
          title={view === 'queue' ? 'Nothing needs attention' : 'No payouts yet'}
          description={
            view === 'queue'
              ? 'No payouts are awaiting approval or flagged for review.'
              : 'Campaign payouts will appear here once organizers request them.'
          }
        />
      ) : (
        <Stack spacing={2}>
          {payouts.map((p) => (
            <PayoutCard key={p.id} payout={p} onApprove={approve} approving={approvingId === p.id} />
          ))}
        </Stack>
      )}
    </Box>
  )
}
