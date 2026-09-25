import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { Link as RouterLink } from 'react-router-dom'
import { payoutInstitutionName, type Affiliate } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { setPayoutRecipient } from '@/lib/affiliate'
import type { Account } from '@/components/account/SavedPayoutAccounts'

/**
 * Where affiliate payouts go. A payout can only be requested once a
 * destination is set, and only a saved account whose provider-held name
 * matched can be used — the same check campaign cashouts and creator
 * withdrawals rely on.
 */
export function AffiliatePayoutDestination({
  affiliate,
  onSaved,
}: {
  affiliate: Pick<Affiliate, 'recipientCode' | 'accountName' | 'bankCode' | 'accountNumber'>
  onSaved: () => void
}) {
  const hasDestination = Boolean(affiliate.recipientCode)
  const [editing, setEditing] = useState(!hasDestination)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [choice, setChoice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) return
    let active = true
    api
      .get<{ accounts: Account[] }>('/payout-accounts')
      .then((data) => {
        if (!active) return
        setAccounts(data.accounts)
        const firstMatched = data.accounts.find((a) => a.verificationStatus === 'name_matched')
        setChoice((current) => current || firstMatched?.id || '')
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load your payout accounts.')
      })
    return () => {
      active = false
    }
  }, [editing])

  async function save() {
    setSaving(true)
    setError('')
    try {
      await setPayoutRecipient(choice)
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your payout destination.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing)
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
          Payouts go to {affiliate.accountName} ·{' '}
          {payoutInstitutionName(affiliate.bankCode ?? '', affiliate.bankCode ?? '')} · ••
          {(affiliate.accountNumber ?? '').slice(-4)}
        </Typography>
        <Button size="small" onClick={() => setEditing(true)} sx={{ textTransform: 'none', px: 0 }}>
          Change payout destination
        </Button>
      </Box>
    )

  const matched = (accounts ?? []).filter((a) => a.verificationStatus === 'name_matched')
  return (
    <Box sx={{ mt: 1.5 }} aria-label="Payout destination">
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1 }}>Payout destination</Typography>
      {accounts && matched.length === 0 ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          Add a bank or mobile-money account whose name matches the account holder, then choose it
          here.
        </Alert>
      ) : (
        <TextField
          select
          fullWidth
          size="small"
          label="Saved payout account"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={!accounts}
        >
          {(accounts ?? []).map((a) => (
            <MenuItem key={a.id} value={a.id} disabled={a.verificationStatus !== 'name_matched'}>
              {a.accountName} · {payoutInstitutionName(a.bankCode, a.bankCode)} · {a.last4}
              {a.verificationStatus !== 'name_matched' ? ' (name not matched)' : ''}
            </MenuItem>
          ))}
        </TextField>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          disabled={!choice || saving}
          onClick={() => void save()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {saving ? 'Saving…' : 'Use this account'}
        </Button>
        {hasDestination && (
          <Button size="small" onClick={() => setEditing(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
        )}
        <Button component={RouterLink} to="/payout-accounts" size="small" sx={{ textTransform: 'none' }}>
          Add or manage payout accounts
        </Button>
      </Box>
    </Box>
  )
}
