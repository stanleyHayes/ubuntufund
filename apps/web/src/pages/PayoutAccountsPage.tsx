import { useSeo } from '@/lib/seo'
import { Box, Container } from '@mui/material'
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded'
import { AccountHeading } from '@/components/account/AccountPage'
import { SavedPayoutAccounts } from '@/components/account/SavedPayoutAccounts'
import { PayoutAccounts } from '@/components/account/PayoutAccounts'
export function PayoutAccountsPage() {
  useSeo({
    title: 'Payout accounts | Ujimora',
    description:
      'Add the mobile money or bank accounts where Ujimora should send your campaign and creator earnings, and choose which one is paid out by default.',
    path: '/payout-accounts',
    robots: 'noindex, nofollow',
  })
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <AccountHeading
        title="Payout accounts"
        description="Choose where your campaign and creator earnings go."
        icon={<AccountBalanceRounded />}
      />
      <SavedPayoutAccounts />
      <Box sx={{ mt: 5 }}>
        <PayoutAccounts />
      </Box>
    </Container>
  )
}
