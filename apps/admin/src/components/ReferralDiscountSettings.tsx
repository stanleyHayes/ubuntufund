import { useEffect, useState } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'

/** Namespaced so it cannot collide with a payout field of the same name. */
const KEY = 'affiliate.referralDiscountPercent'

/**
 * The discount a referee gets for entering an affiliate's referral code at
 * checkout.
 *
 * Lives in the versioned commercial-config store rather than an env var, so
 * changing it is a dashboard action with an audit trail (who, when, why) rather
 * than a deploy. Setting it to 0 switches the behaviour off entirely: an
 * affiliate code typed into the coupon box is then simply an unknown code.
 */
export function ReferralDiscountSettings({ canEdit }: { canEdit: boolean }) {
  const [percent, setPercent] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api
      .get<{ resolved: Record<string, number> }>('/admin/commercial-config')
      .then((r) => {
        if (active) setPercent(String(r.resolved[KEY] ?? 0))
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the referral discount.')
      })
    return () => {
      active = false
    }
  }, [])

  const value = Number(percent)
  const invalid = !percent || !Number.isFinite(value) || value < 0 || value > 100

  async function save() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.put(`/admin/commercial-config/${KEY}`, {
        value,
        reason: 'Affiliate referral discount updated from platform settings',
      })
      setMessage(
        value > 0
          ? `Saved. Someone entering an affiliate's code at checkout now saves ${value}% on their first paid plan, and the referrer still earns their commission.`
          : 'Saved. Affiliate codes no longer give a discount; they still credit the referrer when used at signup.'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the referral discount.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3, my: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
      <Typography variant="h6">Affiliate referral discount</Typography>
      <Typography variant="body2" sx={{ my: 2 }}>
        What a new customer saves for entering an affiliate&apos;s referral code in the coupon
        box at checkout. It applies once, to a first paid subscription, and never to a renewal.
        The referrer is paid their commission on the full list price, so this discount comes out
        of platform margin rather than theirs. Set it to 0 to turn discounts off — codes still
        credit the referrer when used at signup.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <TextField
        label="Referral discount (%)"
        type="number"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        disabled={!canEdit || busy}
        slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 } }}
      />
      <Button onClick={() => void save()} disabled={!canEdit || busy || invalid}>
        Save referral discount
      </Button>
    </Box>
  )
}
