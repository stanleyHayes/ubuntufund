import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { api } from '@/lib/api'
type Policy = {
  enabled: boolean
  maxAmount: number
  dailyOwnerLimit: number
  dailyPlatformLimit: number
  reviewMaxAgeDays: number
  mobileMoneyMaxAmount: number
  mobileMoneyReviewMaxAgeHours: number
}
export function AutomaticPayoutSettings({ canEdit }: { canEdit: boolean }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () =>
    api
      .get<Policy>('/admin/automatic-payouts')
      .then(setPolicy)
      .catch((e) => setError(e.message))
  useEffect(() => {
    void load()
  }, [])
  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.put('/admin/automatic-payouts', policy)
      setNotice('Automatic payout policy saved. Applies to new requests.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save policy')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Box
      sx={{
        p: 3,
        my: 3,
        bgcolor: 'var(--neu-surface)',
        boxShadow: 'var(--neu-raised)',
        borderRadius: 3,
      }}
    >
      <Typography variant="h6">Automatic payouts</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
        Repeat standard payouts can proceed automatically after a successful, manually reviewed
        payout to the same destination. Verified owners, a current destination review, no open
        disputes and the limits below are required. First-time destinations, early cashout and
        exceptions remain in the review queue.
      </Typography>
      {error && (
        <Alert
          severity="error"
          action={!policy ? <Button onClick={() => void load()}>Retry</Button> : undefined}
        >
          {error}
        </Alert>
      )}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!policy ? (
        !error && <Skeleton height={160} />
      ) : (
        <>
          <FormControlLabel
            label="Enable automatic payouts"
            control={
              <Switch
                disabled={!canEdit || busy}
                checked={policy.enabled}
                onChange={(_, enabled) => setPolicy({ ...policy, enabled })}
              />
            }
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              my: 2,
            }}
          >
            {(
              [
                ['maxAmount', 'Maximum per request (GHS)'],
                ['dailyOwnerLimit', 'Daily limit per owner (GHS)'],
                ['dailyPlatformLimit', 'Daily platform limit (GHS)'],
                ['reviewMaxAgeDays', 'Bank review validity (days)'],
                ['mobileMoneyMaxAmount', 'MoMo maximum per request (GHS)'],
                ['mobileMoneyReviewMaxAgeHours', 'MoMo review validity (hours)'],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                type="number"
                label={label}
                value={policy[key]}
                disabled={!canEdit || busy}
                onChange={(e) => setPolicy({ ...policy, [key]: Number(e.target.value) })}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Daily limits reset at midnight UTC and include attempted automatic payouts. MoMo
            receiving capacity is not available through Paystack; requests may still fail at the
            network. Failed transfers are reconciled before funds become available again.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" disabled={!canEdit || busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save automatic payout policy'}
            </Button>
          </Box>
        </>
      )}
      <Alert severity="info" sx={{ mt: 3 }}>
        Paystack setup is separate: under Settings → Preferences, turn off “Confirm transfers before
        sending” to remove per-transfer OTPs. Configure the server approval URL only after
        deployment and a test transfer:{' '}
        <Box component="code" sx={{ display: 'block', overflowWrap: 'anywhere', my: 1 }}>
          https://api.ujimora.com/api/v1/payouts/paystack-approval
        </Box>
        Changing this policy does not change your Paystack security settings.
      </Alert>
    </Box>
  )
}
