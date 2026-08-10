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
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
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
  [TransactionStatus.COMPLETED]: { bg: 'rgba(46, 61, 47,0.08)', color: '#2E3D2F' },
  [TransactionStatus.PENDING]: { bg: 'rgba(255,167,38,0.1)', color: '#E65100' },
  [TransactionStatus.FAILED]: { bg: 'rgba(239,83,80,0.08)', color: '#A5432F' },
  [TransactionStatus.REVERSED]: { bg: 'rgba(156,39,176,0.08)', color: '#4A6B75' },
}

function formatTxType(type: TransactionType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// WalletPage
// ---------------------------------------------------------------------------

export function WalletPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Wallet[]>('/wallets')
      .then(setWallets)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false))

    api.get<Transaction[]>('/wallets/transactions')
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false))
  }, [])

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 900,
            fontSize: { xs: '1.5rem', md: '1.8rem' },
            mb: 1,
            animation: `${fadeInUp} 0.4s ease`,
          }}
        >
          Wallet
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 4, animation: `${fadeInUp} 0.4s 0.05s ease both` }}>
          Review your wallet balance and recorded contribution activity.
        </Typography>

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
          <Card
            elevation={0}
            sx={{ textAlign: 'center', p: 6, border: '1.5px dashed rgba(0,0,0,0.1)', borderRadius: SHAPE.card, mb: 6 }}
          >
            <AccountBalanceWalletRoundedIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
            <Typography sx={{ fontWeight: 700, mb: 1 }}>No wallets found</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              Your wallets will appear here once your account is set up.
            </Typography>
          </Card>
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
                      border: '1px solid rgba(0,0,0,0.06)',
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
                      <Typography sx={{ fontSize: '1.75rem', fontFamily: '"Outfit", sans-serif', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
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
                      <Alert severity="info" icon={false} sx={{ py: 0.5, fontSize: '0.78rem' }}>
                        External deposits and withdrawals are unavailable until verified payment and payout providers are connected.
                      </Alert>
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

        {txLoading ? (
          <TableContainer
            component={Paper}
            sx={{ borderRadius: SHAPE.card, border: '1px solid rgba(0,0,0,0.06)', boxShadow: 'none' }}
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
            sx={{ p: { xs: 3, md: 4 }, border: '1px solid rgba(0,0,0,0.06)', borderRadius: SHAPE.card }}
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
            sx={{ borderRadius: SHAPE.card, border: '1px solid rgba(0,0,0,0.06)', boxShadow: 'none' }}
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
