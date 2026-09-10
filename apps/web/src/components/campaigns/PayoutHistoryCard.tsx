import { Box, Chip, Typography } from '@mui/material'
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded'
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import type { Payout } from '@ubuntu-fund/types'

const statuses: Record<Payout['status'], { label: string; detail: string }> = {
  PENDING: {
    label: 'Awaiting review',
    detail: 'Your request is with the admin team. No transfer has been sent yet.',
  },
  PROCESSING: {
    label: 'Processing',
    detail:
      'Your transfer is being processed. Wait for confirmation before making another request.',
  },
  PAID: { label: 'Completed', detail: 'Your payout has been completed.' },
  FAILED: {
    label: 'Failed',
    detail: 'Refresh your balance and check your destination before requesting again.',
  },
  REVERSED: {
    label: 'Reversed',
    detail: 'The transfer was reversed. Refresh your balance before requesting again.',
  },
  NEEDS_REVIEW: {
    label: 'Needs attention',
    detail:
      'The team needs to reconcile this payout. Contact support with the reference below; do not submit a duplicate.',
  },
}
export function PayoutHistoryCard({ payout }: { payout: Payout }) {
  const state =
    payout.status === 'PROCESSING' && payout.providerStatus === 'otp'
      ? {
          label: 'Awaiting authorization',
          detail:
            'The admin team must authorize this transfer with Paystack. You do not need to enter an OTP.',
        }
      : statuses[payout.status]
  const wallet = payout.provider === 'ujimora_wallet'
  const Icon = wallet ? AccountBalanceWalletRounded : AccountBalanceRounded
  const money = (amount: number) =>
    `${payout.currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <Box
      component="article"
      aria-label={`Payout ${state.label}`}
      sx={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        p: { xs: 2.5, sm: 3 },
        my: 2,
        bgcolor: 'var(--neu-surface)',
        boxShadow: 'var(--neu-raised)',
        borderRadius: 'var(--shape-card, 20px)',
      }}
    >
      <AccountBalanceWalletRounded
        aria-hidden="true"
        sx={{
          position: 'absolute',
          right: -35,
          top: 30,
          fontSize: { xs: 180, sm: 240 },
          opacity: 0.045,
          transform: 'rotate(-18deg)',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box
            sx={{
              p: 1.2,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--shape-button, 10px)',
              boxShadow: 'var(--neu-inset)',
              color: 'text.secondary',
            }}
          >
            <Icon />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {wallet ? 'Ujimora Wallet' : 'Bank / mobile money'}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'capitalize' }}
            >
              {payout.type} cashout
            </Typography>
          </Box>
        </Box>
        <Chip
          size="small"
          icon={payout.status === 'PENDING' ? <ScheduleRounded /> : undefined}
          label={state.label}
          sx={{ bgcolor: 'action.selected', color: 'text.primary', fontWeight: 700 }}
        />
      </Box>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '.12em' }}>
        {payout.status === 'PAID' ? 'Amount received' : 'Net payout'}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '1.75rem', sm: '2.1rem' },
          fontWeight: 850,
          lineHeight: 1.2,
          mb: 1,
          overflowWrap: 'anywhere',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {money(payout.netAmount)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, lineHeight: 1.6 }}>
        {state.detail}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
          gap: 2,
          mt: 3,
          pt: 2.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {[
          ['Requested', money(payout.amount)],
          ['Cashout service fee', money(payout.fee)],
          [
            'Requested on',
            new Date(payout.createdAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          ],
        ].map(([label, value]) => (
          <Box
            key={label}
            sx={{ display: { xs: 'flex', sm: 'block' }, justifyContent: 'space-between', gap: 2 }}
          >
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 2.5, overflowWrap: 'anywhere' }}
      >
        Request · {payout.id}
        {payout.providerRef && (
          <>
            <br />
            Paystack reference · {payout.providerRef}
          </>
        )}
      </Typography>
    </Box>
  )
}
