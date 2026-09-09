import { LoadingDots } from '@ubuntu-fund/ui'
import Button from '@mui/material/Button'
import { BrandedTextField } from '@ubuntu-fund/ui'
import { useSearchParams } from 'react-router-dom'
import { request } from '@/lib/api'
import { storedAccessToken } from '@/lib/session'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import { AccountHeading } from '@/components/account/AccountPage'
import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import { keyframes } from '@emotion/react'
import { formatCurrency, SHAPE, EmptyState } from '@ubuntu-fund/ui'
import {
  WalletType,
  TransactionType,
  TransactionStatus,
  type Wallet,
  type Transaction,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALLET_COLORS: Record<string, { accent: string; bg: string; gradient: string }> = {
  [WalletType.LOCAL]: { accent: '#2E3D2F', bg: 'rgba(46, 61, 47,0.05)', gradient: 'linear-gradient(135deg, #2F6B46, #2E3D2F)' },
  [WalletType.FOREIGN]: { accent: '#1565C0', bg: 'rgba(21,101,192,0.05)', gradient: 'linear-gradient(135deg, #4A6B75, #1565C0)' },
  [WalletType.CRYPTO]: { accent: '#A07E33', bg: 'rgba(245,127,23,0.05)', gradient: 'linear-gradient(135deg, #FFD54F, #A07E33)' },
}

const WALLET_LABELS: Record<string, string> = {
  [WalletType.LOCAL]: 'Local Currency Wallet',
  [WalletType.FOREIGN]: 'Foreign Currency Wallet',
  [WalletType.CRYPTO]: 'Crypto Wallet',
}

const TX_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  [TransactionStatus.COMPLETED]: { bg: 'rgba(46, 61, 47,0.08)', color: 'var(--text-brand)' },
  [TransactionStatus.PENDING]: { bg: 'rgba(255,167,38,0.1)', color: 'var(--text-warning)' },
  [TransactionStatus.FAILED]: { bg: 'rgba(239,83,80,0.08)', color: 'var(--text-error)' },
  [TransactionStatus.REVERSED]: { bg: 'rgba(156,39,176,0.08)', color: 'var(--text-info)' },
}

function formatTxType(type: TransactionType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// WalletPage
// ---------------------------------------------------------------------------

export function WalletPage() {
  const [searchParams] = useSearchParams()
  const [topUpConfig, setTopUpConfig] = useState<{ enabled: boolean; mode: string } | null>(null)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)
  const [topUpError, setTopUpError] = useState('')
  const [topUpStatus, setTopUpStatus] = useState('')
  const [revision, setRevision] = useState(0)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [txError, setTxError] = useState<string | null>(null)
  const [txLoading, setTxLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ enabled: boolean; mode: string }>('/wallets/topups/config').then(setTopUpConfig).catch(() => setTopUpConfig({ enabled: false, mode: 'test' }))
    api.get<Wallet[]>('/wallets')
      .then(setWallets)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false))

    api.get<Transaction[]>('/wallets/transactions')
      .then(setTransactions)
      .catch((err: Error) => setTxError(err.message))
      .finally(() => setTxLoading(false))
  }, [revision])

  const returnedReference = searchParams.get('reference') ?? searchParams.get('trxref')
  useEffect(() => {
    if (!returnedReference?.startsWith('wtop-')) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let attempts = 0
    async function check() {
      try {
        const result = await api.get<{ status: string }>(`/wallets/topups/${encodeURIComponent(returnedReference!)}`)
        if (cancelled) return
        if (result.status === 'completed' || result.status === 'failed') {
          const storageKey = sessionStorage.getItem(`ujimora-topup-reference-${returnedReference}`)
          if (storageKey) sessionStorage.removeItem(storageKey)
          setTopUpStatus(result.status === 'completed' ? 'Your wallet has been funded.' : 'Payment was not completed. You can start a new top-up.'); setRevision(value => value + 1); return }
        setTopUpStatus('Payment is awaiting confirmation. Your balance updates after Paystack confirms it.')
        if (++attempts < 12) timer = setTimeout(check, 5000)
      } catch (err) { if (!cancelled) setTopUpError(err instanceof Error ? err.message : 'Could not verify top-up. Refresh to retry.') }
    }
    void check()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [returnedReference])

  async function fundWallet(walletId: string) {
    setTopUpBusy(true); setTopUpError('')
    const amount = Number(topUpAmount)
    const storageKey = `ujimora-topup-${walletId}-${amount}`
    try {
      const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID()
      sessionStorage.setItem(storageKey, key)
      const response = await request<{ data: { authorizationUrl?: string; reference: string; status: string } }>('/wallets/topups', { method: 'POST', token: storedAccessToken() ?? undefined, headers: { 'Idempotency-Key': key }, body: JSON.stringify({ walletId, amount }) })
      const result = response.data
      if (result.status === 'completed') { setTopUpStatus('This top-up is already completed.'); sessionStorage.removeItem(storageKey); setRevision(value => value + 1); return }
      sessionStorage.setItem(`ujimora-topup-reference-${result.reference}`, storageKey)
      if (!result.authorizationUrl?.startsWith('https://') || result.status === 'failed') { window.location.assign(`/wallet?reference=${encodeURIComponent(result.reference)}`); return }
      window.location.assign(result.authorizationUrl)
    } catch (err) { setTopUpError(err instanceof Error ? err.message : 'Could not start top-up.') }
    finally { setTopUpBusy(false) }
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        <AccountHeading title="Wallet" description="Your balances and transaction history, in one place." icon={<AccountBalanceWalletRoundedIcon />} />

        {topUpStatus && <Alert severity="info" sx={{ mb: 2 }}>{topUpStatus}</Alert>}
        {topUpError && <Alert severity="error" sx={{ mb: 2 }}>{topUpError}</Alert>}
        {/* ===== Wallet Cards ===== */}
        {isLoading ? (
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {[0, 1, 2].map((i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rounded" height={220} sx={{ borderRadius: SHAPE.card }} />
              </Grid>
            ))}
          </Grid>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: SHAPE.card, mb: 4 }}>{error}</Alert>
        ) : wallets.length === 0 ? (
          <EmptyState compact variant="noData" title="Your wallet is getting ready" description="Your wallets will appear here once your account is set up." />
        ) : (
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {wallets.map((wallet, idx) => {
              const colors = WALLET_COLORS[wallet.type] ?? WALLET_COLORS[WalletType.LOCAL]
              const label = WALLET_LABELS[wallet.type] ?? 'Wallet'
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={wallet.id}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: SHAPE.card,
                      overflow: 'hidden',
                      boxShadow: 'var(--neu-raised)',
                      animation: `${fadeInUp} 0.4s ${0.1 + idx * 0.08}s ease both`,
                      transition: 'border-color 0.2s ease',
                      '&:hover': { borderColor: 'rgba(0,0,0,0.18)' },
                    }}
                  >
                    {/* Gradient header */}
                    <Box sx={{ background: colors.gradient, px: 3, py: 2.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>
                        {label}
                      </Typography>
                      <Typography sx={{ overflowWrap: 'anywhere', fontSize: { xs: '1.5rem', md: '1.75rem' }, fontFamily: '"Outfit", sans-serif', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                        {formatCurrency(wallet.balance, wallet.currency)}
                      </Typography>
                    </Box>

                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                          Currency: {wallet.currency}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                          Updated {new Date(wallet.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </Typography>
                      </Box>
                      {wallet.currency === 'GHS' && topUpConfig?.enabled && <Box sx={{ display: 'grid', gap: 1.5 }}>
                        {topUpConfig.mode === 'test' && <Alert severity="info">Test payments only. No real money moves in this mode.</Alert>}
                        <BrandedTextField label="Top-up amount (GHS)" type="number" value={topUpAmount} onChange={event => setTopUpAmount(event.target.value)} disabled={topUpBusy} helperText="GHS 1–10,000. Pay securely by card or MoMo." />
                        <Button variant="contained" disabled={topUpBusy || !topUpAmount || Number(topUpAmount) < 1 || Number(topUpAmount) > 10000} onClick={() => fundWallet(wallet.id)}>{topUpBusy ? <><LoadingDots size={6} /> <span>Opening checkout…</span></> : 'Fund wallet'}</Button>
                        <Typography variant="caption" color="text.secondary">Your balance is credited only after payment confirmation. The full top-up amount reaches your wallet.</Typography>
                      </Box>}
                      {topUpConfig && !topUpConfig.enabled && <Alert severity="info">Wallet funding is not configured yet.</Alert>}
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>External withdrawals are not available from this wallet.</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}

        {/* ===== Transaction History ===== */}
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 800,
            fontSize: { xs: '1.2rem', md: '1.4rem' },
            mb: 3,
          }}
        >
          Transaction History
        </Typography>

        {txError ? <Alert severity="error">{txError}</Alert> : txLoading ? (
          <TableContainer
            component={Paper}
            sx={{ borderRadius: SHAPE.card, boxShadow: 'var(--neu-raised)' }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  {['Type', 'Amount', 'Status', 'Reference', 'Date'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="text" width={80} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="rounded" width={72} height={24} sx={{ borderRadius: SHAPE.sm }} /></TableCell>
                    <TableCell><Skeleton variant="text" width={120} /></TableCell>
                    <TableCell><Skeleton variant="text" width={90} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : transactions.length === 0 ? (
          <Card
            elevation={0}
            sx={{ p: { xs: 3, md: 4 }, boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card }}
          >
            <EmptyState
              variant="noData"
              title="No transactions yet"
              description="Wallet-backed donations and verified balance changes will show up here."
            />
          </Card>
        ) : (
          <TableContainer
            component={Paper}
            sx={{ borderRadius: SHAPE.card, boxShadow: 'var(--neu-raised)' }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => {
                  const statusStyle = TX_STATUS_COLORS[tx.status] ?? TX_STATUS_COLORS[TransactionStatus.PENDING]
                  return (
                    <TableRow key={tx.id} hover>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {formatTxType(tx.type)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontFamily: '"Outfit", monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                          {formatCurrency(tx.amount, tx.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            bgcolor: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', fontFamily: 'monospace' }}>
                          {tx.reference}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

      </Container>
    </Box>
  )
}
