import { useEntrance } from '@/components/motion/useEntrance'
import { Box, Button, Typography } from '@mui/material'
import SmartphoneRounded from '@mui/icons-material/SmartphoneRounded'
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded'
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { payoutAccountBrand } from '@ubuntu-fund/types'
import type { Account } from './SavedPayoutAccounts'

export function PayoutAccountCard({
  account,
  institutionName,
  busy,
  onRemove,
}: {
  account: Account
  institutionName?: string
  busy: boolean
  onRemove: () => void
}) {
  const entrance = useEntrance<HTMLDivElement>()
  const brand = payoutAccountBrand(account.bankCode, institutionName)
  const matched = account.verificationStatus === 'name_matched'
  return (
    <Box ref={entrance} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          minHeight: 225,
          borderRadius: '22px',
          p: { xs: 2.5, sm: 3 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 3,
          bgcolor: brand.background,
          color: brand.foreground,
          boxShadow: 'var(--neu-raised)',
          border: '1px solid rgba(255,255,255,.16)',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            background:
              'linear-gradient(120deg, rgba(255,255,255,.15), transparent 55%, rgba(0,0,0,.1))',
          }}
        />
        <Typography
          aria-hidden
          sx={{
            position: 'absolute',
            right: -12,
            top: 50,
            fontSize: 110,
            fontWeight: 900,
            letterSpacing: '-.08em',
            opacity: 0.1,
            lineHeight: 1,
            transform: 'rotate(-16deg)',
            zIndex: -1,
            userSelect: 'none',
          }}
        >
          {brand.mark}
        </Typography>
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            width: 230,
            height: 230,
            border: '1px solid currentColor',
            borderRadius: '50%',
            right: -75,
            bottom: -120,
            opacity: 0.2,
            '&:after': {
              content: '""',
              position: 'absolute',
              inset: 18,
              border: '1px solid currentColor',
              borderRadius: '50%',
            },
          }}
        />
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-.02em' }}>
            {brand.label}
          </Typography>
          {account.type === 'ghipss' ? <AccountBalanceRounded /> : <SmartphoneRounded />}
        </Box>
        <Box>
          <Typography
            sx={{
              fontSize: '.65rem',
              textTransform: 'uppercase',
              letterSpacing: '.13em',
              opacity: 0.85,
              mb: 0.5,
            }}
          >
            Payout account
          </Typography>
          <Typography
            aria-label={`Account ending ${account.last4}`}
            sx={{
              fontSize: '1.7rem',
              fontWeight: 600,
              letterSpacing: '.12em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            •••• {account.last4}
          </Typography>
        </Box>
        <Box
          sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}
        >
          <Box ref={entrance} sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '.6rem',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                opacity: 0.8,
                mb: 0.5,
              }}
            >
              Account holder
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '.88rem', overflowWrap: 'anywhere' }}>
              {account.accountName}
            </Typography>
          </Box>
          <Typography
            sx={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.05em', flexShrink: 0 }}
          >
            UJIMORA
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          pt: 1.5,
          px: 0.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.7,
            color: matched ? 'text.secondary' : 'var(--text-warning)',
          }}
        >
          {matched ? (
            <VerifiedOutlined sx={{ fontSize: 16 }} />
          ) : (
            <InfoOutlined sx={{ fontSize: 16 }} />
          )}
          <Typography variant="caption">
            {matched ? 'Registered name matched' : 'Ownership review at cashout'}
          </Typography>
        </Box>
        <Button
          size="small"
          aria-label={`Remove saved account ${account.accountName} ending ${account.last4}`}
          disabled={busy}
          onClick={onRemove}
          sx={{ fontSize: '.72rem', minHeight: 32, px: 1, color: 'text.secondary' }}
        >
          Remove saved account
        </Button>
      </Box>
    </Box>
  )
}
