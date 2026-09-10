import { useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded'
import SmartphoneRounded from '@mui/icons-material/SmartphoneRounded'
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
            <Typography color="text.secondary">
              {data.planName} · {data.accounts.length} / {data.limit < 0 ? 'Unlimited' : data.limit}{' '}
              saved
            </Typography>
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
              <Box
                key={a.id}
                sx={{
                  p: 3,
                  bgcolor: 'var(--neu-surface)',
                  border: 'var(--neu-border)',
                  borderRadius: 'var(--shape-card)',
                  boxShadow: 'var(--neu-raised)',
                  backdropFilter: 'var(--neu-backdrop)',
                }}
              >
                {a.type === 'ghipss' ? <AccountBalanceRounded /> : <SmartphoneRounded />}
                <Typography sx={{ fontWeight: 800, mt: 2 }}>{a.accountName}</Typography>
                <Typography color="text.secondary">
                  {a.bankCode} · Ending {a.last4}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {a.verificationStatus === 'name_matched'
                    ? 'Registered name matched'
                    : 'Needs beneficiary review'}
                </Typography>
                <Button disabled={busy} onClick={() => void remove(a.id)} sx={{ mt: 2 }}>
                  Remove saved account
                </Button>
              </Box>
            ))}
          </Box>
          {!data.accounts.length && (
            <Typography sx={{ mb: 3 }}>
              Add a bank account or mobile-money wallet to receive your funds.
            </Typography>
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
                <TextField
                  select
                  required
                  label="Bank or network"
                  value={bankCode}
                  onChange={(e) => setBank(e.target.value)}
                >
                  {banks.map((b) => (
                    <MenuItem key={b.code} value={b.code}>
                      {b.name}
                    </MenuItem>
                  ))}
                </TextField>
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
      ) : (
        <Typography>Loading payout accounts…</Typography>
      )}
    </Box>
  )
}
