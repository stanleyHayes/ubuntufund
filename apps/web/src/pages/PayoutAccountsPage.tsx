import { Box, Container } from '@mui/material'
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded'
import { AccountHeading } from '@/components/account/AccountPage'
import { SavedPayoutAccounts } from '@/components/account/SavedPayoutAccounts'
import { PayoutAccounts } from '@/components/account/PayoutAccounts'
export function PayoutAccountsPage() {
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
