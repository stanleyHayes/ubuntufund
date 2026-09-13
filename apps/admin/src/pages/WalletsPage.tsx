import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import PageHeader from '@/components/PageHeader'
import WalletActivity from '@/components/WalletActivity'
export default function WalletsPage() {
  return <><PageHeader title="Wallets" eyebrow="Community · Wallet oversight" lede="Review member balances and follow wallet activity across the platform." tone="gold" icon={<AccountBalanceWalletRoundedIcon />} /><WalletActivity /></>
}
