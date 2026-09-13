import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { api } from '@/lib/api'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable } from '@/lib/exports/report'
import ExportMenu from './ExportMenu'
import { ReviewQueueEmpty, ReviewQueueSkeleton, ReviewQueueToolbar } from './ReviewQueueStates'
import ReviewQueuePagination from './ReviewQueuePagination'
import { raisedSurface } from '@/lib/surfaces'

type Wallet = { id: string; userId: string; memberName: string; type: string; balance: number; currency: string; updatedAt: string }
type Transaction = { id: string; userId: string; walletId: string; type: string; status: string; amount: number; currency: string; reference: string; createdAt: string }
const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const label = (value: string) => value.replaceAll('_', ' ')

function WalletSection({ userId, transactions = false }: { userId?: string; transactions?: boolean }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ items: (Wallet | Transaction)[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const path = `/admin/wallets${transactions ? '/transactions' : ''}?${userId ? `userId=${encodeURIComponent(userId)}&` : ''}`
  useEffect(() => {
    const controller = new AbortController()
    // Reset the loading surface when the external server query changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError('')
    api.get<typeof result>(`${path}page=${page}&pageSize=${pageSize}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load wallet records') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, page, pageSize, revision])
  const title = transactions ? 'Wallet transactions' : 'Wallet balances'
  const icon = transactions ? <ReceiptLongRoundedIcon /> : <AccountBalanceWalletRoundedIcon />
  return <Stack spacing={2}>
    <ReviewQueueToolbar title={title} description={transactions ? 'Recorded credits, spending and refunds, with their status and reference.' : 'Current spendable wallet funds, shown separately by currency. Campaign proceeds remain in campaign balances.'} icon={icon}>
      <Button startIcon={<RefreshRoundedIcon />} disabled={loading} onClick={() => setRevision(r => r + 1)}>Refresh</Button>
      <ExportMenu title={title} disabled={loading || !!error} getReport={async () => ({ title, filters: userId ? [`Member: ${userId}`] : [], tables: transactions
        ? [exportTable(title, await loadAll<Transaction>(path), { Type: r => label(r.type), Status: r => label(r.status), Amount: r => r.amount, Currency: r => r.currency, Member: r => r.userId, Wallet: r => r.walletId, Reference: r => r.reference, Date: r => r.createdAt })]
        : [exportTable(title, await loadAll<Wallet>(path), { Member: r => r.memberName, 'Member ID': r => r.userId, Type: r => label(r.type), Balance: r => r.balance, Currency: r => r.currency, Updated: r => r.updatedAt })] })} />
    </ReviewQueueToolbar>
    {loading ? <ReviewQueueSkeleton label={`Loading ${title.toLowerCase()}`} /> : error ? <Alert severity="error" action={<Button onClick={() => setRevision(r => r + 1)}>Retry</Button>}>{error}</Alert> : !result.items.length ? <ReviewQueueEmpty title={transactions ? 'No wallet transactions yet' : 'No wallets yet'} description={transactions ? 'Wallet activity will appear here when funds move through a wallet.' : 'A wallet will appear here when one is created for this member.'} icon={icon} /> : <>
      <Box sx={{ ...raisedSurface, overflow: 'hidden' }}>
        {result.items.map(item => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ p: { xs: 2, sm: 3 }, borderBottom: 1, borderColor: 'divider', position: 'relative', overflow: 'hidden' }}>
          <Box aria-hidden sx={{ color: 'primary.main' }}>{icon}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ textTransform: 'capitalize' }}>{label(item.type)}</Typography>
            {'memberName' in item ? <Typography component={RouterLink} to={`/users/${item.userId}`} color="text.secondary">{item.memberName}</Typography> : <><Typography variant="body2" color="text.secondary">{new Date(item.createdAt).toLocaleString()}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere', display: 'block' }}>Reference: {item.reference}</Typography>{!userId && <Button component={RouterLink} to={`/users/${item.userId}`} size="small">View member</Button>}</>}
          </Box>
          {'status' in item && <Chip label={label(item.status)} size="small" />}
          <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{money('balance' in item ? item.balance : item.amount, item.currency)}</Typography>
        </Stack>)}
      </Box>
      <ReviewQueuePagination page={page} pageSize={pageSize} total={result.total} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>}
  </Stack>
}
export default function WalletActivity({ userId }: { userId?: string }) {
  return <Stack spacing={3}><WalletSection key={`${userId}-balances`} userId={userId} /><WalletSection key={`${userId}-transactions`} userId={userId} transactions /></Stack>
}
