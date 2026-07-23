import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
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
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import { keyframes } from '@emotion/react'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
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
  [WalletType.LOCAL]: { accent: '#2E7D32', bg: 'rgba(46,125,50,0.05)', gradient: 'linear-gradient(135deg, #66BB6A, #2E7D32)' },
  [WalletType.FOREIGN]: { accent: '#1565C0', bg: 'rgba(21,101,192,0.05)', gradient: 'linear-gradient(135deg, #42A5F5, #1565C0)' },
  [WalletType.CRYPTO]: { accent: '#F57F17', bg: 'rgba(245,127,23,0.05)', gradient: 'linear-gradient(135deg, #FFD54F, #F57F17)' },
}

const WALLET_LABELS: Record<string, string> = {
  [WalletType.LOCAL]: 'Local Currency Wallet',
  [WalletType.FOREIGN]: 'Foreign Currency Wallet',
  [WalletType.CRYPTO]: 'Crypto Wallet',
}

const TX_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  [TransactionStatus.COMPLETED]: { bg: 'rgba(46,125,50,0.08)', color: '#2E7D32' },
  [TransactionStatus.PENDING]: { bg: 'rgba(255,167,38,0.1)', color: '#E65100' },
  [TransactionStatus.FAILED]: { bg: 'rgba(239,83,80,0.08)', color: '#E53935' },
  [TransactionStatus.REVERSED]: { bg: 'rgba(156,39,176,0.08)', color: '#7B1FA2' },
}

const PAYMENT_METHODS = ['Mobile Money', 'Bank Transfer', 'Card', 'Crypto']
const WITHDRAW_DESTINATIONS = ['Bank Account', 'Mobile Money', 'Crypto Wallet']

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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'deposit' | 'withdraw'>('deposit')
  const [dialogWallet, setDialogWallet] = useState<Wallet | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [destination, setDestination] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [snackMessage, setSnackMessage] = useState('')

  const fetchTransactions = useCallback(() => {
    setTxLoading(true)
    api.get<Transaction[]>('/wallets/transactions')
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false))
  }, [])

  useEffect(() => {
    api.get<Wallet[]>('/wallets')
      .then(setWallets)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false))

    fetchTransactions()
  }, [fetchTransactions])

  function openDialog(type: 'deposit' | 'withdraw', wallet: Wallet) {
    setDialogType(type)
    setDialogWallet(wallet)
    setAmount('')
    setPaymentMethod('')
    setDestination('')
    setDialogOpen(true)
  }

  async function handleAction() {
    if (!dialogWallet || !amount || Number(amount) <= 0) return
    setActionLoading(true)
    try {
      const endpoint = `/wallets/${dialogWallet.id}/${dialogType}`
      const res = await api.post<Wallet>(endpoint, {
        amount: Number(amount),
        currency: dialogWallet.currency,
        ...(dialogType === 'deposit' ? { paymentMethod } : { destination }),
      })
      setWallets((prev) => prev.map((w) => w.id === dialogWallet.id ? { ...w, balance: res.balance } : w))
      setDialogOpen(false)
      setSnackMessage(`${dialogType === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!`)
      fetchTransactions()
    } catch (err) {
      setSnackMessage(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Box sx={{ bgcolor: '#FAFAF5', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        <Typography
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 900,
            fontSize: { xs: '1.5rem', md: '1.8rem' },
            mb: 1,
            animation: `${fadeInUp} 0.4s ease`,
          }}
        >
          Wallet
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 4, animation: `${fadeInUp} 0.4s 0.05s ease both` }}>
          Manage your funds, deposit, and withdraw.
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
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 40px rgba(0,0,0,0.08)' },
                    }}
                  >
                    {/* Gradient header */}
                    <Box sx={{ background: colors.gradient, px: 3, py: 2.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>
                        {label}
                      </Typography>
                      <Typography sx={{ fontSize: '1.75rem', fontFamily: '"TT Squares", sans-serif', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
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
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<ArrowDownwardRoundedIcon sx={{ fontSize: '16px !important' }} />}
                          onClick={() => openDialog('deposit', wallet)}
                          sx={{
                            flex: 1,
                            borderRadius: SHAPE.sm,
                            fontWeight: 700,
                            fontFamily: '"TT Squares", sans-serif',
                            textTransform: 'none',
                            bgcolor: colors.accent,
                            '&:hover': { bgcolor: colors.accent, filter: 'brightness(0.9)' },
                          }}
                        >
                          Deposit
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ArrowUpwardRoundedIcon sx={{ fontSize: '16px !important' }} />}
                          onClick={() => openDialog('withdraw', wallet)}
                          sx={{
                            flex: 1,
                            borderRadius: SHAPE.sm,
                            fontWeight: 700,
                            fontFamily: '"TT Squares", sans-serif',
                            textTransform: 'none',
                            borderColor: colors.accent,
                            color: colors.accent,
                          }}
                        >
                          Withdraw
                        </Button>
                      </Box>
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
            fontFamily: '"TT Squares", sans-serif',
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
            sx={{ textAlign: 'center', p: 5, border: '1px solid rgba(0,0,0,0.06)', borderRadius: SHAPE.card }}
          >
            <Typography sx={{ color: 'text.secondary' }}>No transactions yet</Typography>
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
                        <Typography sx={{ fontFamily: '"TT Squares", monospace', fontWeight: 700, fontSize: '0.85rem' }}>
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

        {/* ===== Deposit / Withdraw Dialog ===== */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          fullWidth
          maxWidth="xs"
          PaperProps={{ sx: { borderRadius: SHAPE.card } }}
        >
          <DialogTitle sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 700 }}>
            {dialogType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ color: 'text.secondary', mb: 2.5, fontSize: '0.9rem' }}>
              {dialogType === 'deposit' ? 'Add funds to' : 'Withdraw funds from'} your{' '}
              {dialogWallet ? WALLET_LABELS[dialogWallet.type]?.toLowerCase() ?? 'wallet' : 'wallet'} ({dialogWallet?.currency})
            </Typography>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={actionLoading}
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>{dialogWallet?.currency}</Typography>,
              }}
            />
            {dialogType === 'deposit' ? (
              <TextField
                select
                fullWidth
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={actionLoading}
              >
                {PAYMENT_METHODS.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                select
                fullWidth
                label="Destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={actionLoading}
              >
                {WITHDRAW_DESTINATIONS.map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </TextField>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={actionLoading} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAction}
              disabled={!amount || Number(amount) <= 0 || actionLoading}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: SHAPE.sm,
                bgcolor: dialogType === 'deposit' ? '#2E7D32' : '#F57F17',
                '&:hover': { bgcolor: dialogType === 'deposit' ? '#1B5E20' : '#E65100' },
              }}
            >
              {actionLoading ? 'Processing...' : dialogType === 'deposit' ? 'Deposit' : 'Withdraw'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!snackMessage}
          autoHideDuration={3000}
          onClose={() => setSnackMessage('')}
          message={snackMessage}
        />
      </Container>
    </Box>
  )
}
