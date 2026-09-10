import { BankPicker } from '@/components/account/BankPicker'
import { PayoutAccountCard } from './PayoutAccountCard'
import { EmptyState } from '@ubuntu-fund/ui'
import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
  Skeleton,
  LinearProgress,
} from '@mui/material'
import { api } from '@/lib/api'
export type Account = {
  id: string
  type: string
  accountName: string
  last4: string
  bankCode: string
  verificationStatus: string
}
type Data = { planName: string; limit: number; accounts: Account[] }
export function SavedPayoutAccounts() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [directory, setDirectory] = useState<{ name: string; code: string }[]>([])
  useEffect(() => {
    let active = true
    Promise.all(
      ['mobile_money', 'ghipss'].map((type) =>
        api.get<{ name: string; code: string }[]>(`/banks?currency=GHS&type=${type}`),
      ),
    )
      .then((values) => {
        if (active) setDirectory(values.flat())
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [type, setType] = useState('mobile_money')
  const [bankCode, setBank] = useState('')
  const [accountName, setName] = useState('')
  const [accountNumber, setNumber] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .get<Data>('/payout-accounts')
      .then((v) => {
        if (active) {
          setData(v)
          setError('')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])
  useEffect(() => {
    let active = true
    api
      .get<{ name: string; code: string }[]>(`/banks?currency=GHS&type=${type}`)
      .then((v) => {
        if (active) setBanks(v)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [type, retry])
  async function save() {
    setBusy(true)
    setError('')
    try {
      setData(
        await api.post<Data>('/payout-accounts', { type, bankCode, accountName, accountNumber }),
      )
      setNumber('')
      setName('')
      setNotice('Payout account saved. Check its verification status below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save account')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: string) {
    setBusy(true)
    setError('')
    try {
      setData(await api.delete<Data>(`/payout-accounts/${id}`))
      setNotice(
        'Removed from saved accounts. Existing payout requests keep their original destination.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove account')
    } finally {
      setBusy(false)
    }
  }
  const full = !!data && data.limit >= 0 && data.accounts.length >= data.limit
  return (
    <Box>
      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => setRetry((r) => r + 1)}>Retry</Button>}
        >
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      {data ? (
        <>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              mb: 3,
            }}
          >
            <Typography variant="h6">Your payout destinations</Typography>
            <Box sx={{ minWidth: 210, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 3,
                  alignItems: 'baseline',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'var(--text-warning)' }}
                >
                  {data.planName} plan
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {data.accounts.length}
                  {data.limit >= 0 ? ` of ${data.limit}` : ''} saved
                </Typography>
              </Box>
              {data.limit > 0 && (
                <LinearProgress
                  aria-label="Saved payout account capacity"
                  variant="determinate"
                  value={Math.min(100, (data.accounts.length / data.limit) * 100)}
                  color="secondary"
                  sx={{ height: 4, my: 1 }}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                {data.limit < 0
                  ? 'Unlimited payout accounts'
                  : full
                    ? 'All account slots used'
                    : `${data.limit - data.accounts.length} account ${data.limit - data.accounts.length === 1 ? 'slot' : 'slots'} available`}
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' },
              gap: 2,
              mb: 4,
            }}
          >
            {data.accounts.map((a) => (
              <PayoutAccountCard
                key={a.id}
                account={a}
                institutionName={directory.find((b) => b.code === a.bankCode)?.name}
                busy={busy}
                onRemove={() => void remove(a.id)}
              />
            ))}
          </Box>
          {!data.accounts.length && (
            <EmptyState
              compact
              variant="noData"
              title="No saved payout accounts"
              description="Add a bank account or mobile-money wallet below to receive your funds."
            />
          )}
          {full ? (
            <Alert
              severity="info"
              action={
                <Button href="/subscription" sx={{ whiteSpace: 'nowrap' }}>
                  View plans
                </Button>
              }
            >
              You have used your saved-account allowance. Existing accounts remain available.
            </Alert>
          ) : (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
              sx={{
                p: { xs: 2, md: 3 },
                bgcolor: 'var(--neu-surface)',
                borderRadius: 'var(--shape-card)',
                boxShadow: 'var(--neu-inset)',
                border: 'var(--neu-border)',
              }}
            >
              <Typography variant="h6" sx={{ mb: 2 }}>
                Add payout account
              </Typography>
              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
              >
                <TextField
                  select
                  label="Account type"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value)
                    setBank('')
                  }}
                >
                  <MenuItem value="mobile_money">Mobile money</MenuItem>
                  <MenuItem value="ghipss">Bank account</MenuItem>
                </TextField>
                <BankPicker
                  banks={banks}
                  value={bankCode}
                  onChange={setBank}
                  label="Bank or network"
                  required
                />
                <TextField
                  required
                  label="Registered account name"
                  value={accountName}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  required
                  label="Account or MoMo number"
                  value={accountNumber}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </Box>
              <Button type="submit" variant="contained" disabled={busy} sx={{ mt: 2 }}>
                Verify & save account
              </Button>
            </Box>
          )}
          <Typography color="text.secondary" variant="body2" sx={{ my: 3 }}>
            Name matching does not guarantee ownership or receiving capacity. Check MoMo wallet
            limits with your network before cashout. Never share your PIN. Removing a saved account
            does not change a destination already attached to a campaign or payout.
          </Typography>
        </>
      ) : loading && !error ? (
        <Box
          role="status"
          aria-label="Loading payout accounts"
          aria-busy="true"
          sx={{
            display: 'grid',
            gap: 2,
            '& .MuiSkeleton-root': {
              borderRadius: 'var(--shape-sm)',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            },
          }}
        >
          <Skeleton variant="text" width="45%" height={36} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Skeleton variant="rounded" height={130} />
            <Skeleton variant="rounded" height={130} />
          </Box>
          <Skeleton variant="text" width="35%" height={32} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" width={190} height={44} />
        </Box>
      ) : null}
    </Box>
  )
}
