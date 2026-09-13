import { useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { api } from '@/lib/api'

const TIER_KEY = 'campaigns.autoApproveMaxTier'
const ALERT_EMAIL_KEY = 'alerts.reviewEmail'
const THRESHOLD_KEYS = [
  'campaigns.tierThreshold1',
  'campaigns.tierThreshold2',
  'campaigns.tierThreshold3',
  'campaigns.tierThreshold4',
]

/** What each auto-approve setting actually means in money terms. */
const TIER_CHOICES = [
  { value: 0, label: 'Review every campaign up to GHS 250,000' },
  { value: 1, label: 'Auto-approve tier 1' },
  { value: 2, label: 'Auto-approve tiers 1–2' },
  { value: 3, label: 'Auto-approve tiers 1–3' },
  { value: 4, label: 'Auto-approve tiers 1–4' },
  { value: 5, label: 'Auto-approve all tiers up to GHS 250,000' },
]

/**
 * How much fundraising goes live without a person looking at it.
 *
 * Tier policy applies up to GHS 250,000. Above it, the verified returning
 * organizer rule takes precedence. Stored tier boundaries still classify all
 * goals, but cannot waive the higher-goal staff gate.
 *
 * A campaign's tier is fixed at creation, so changing these affects new
 * campaigns only; anything already waiting still needs approving by hand.
 */
export function CampaignReviewSettings({ canEdit }: { canEdit: boolean }) {
  const [tier, setTier] = useState('')
  const [thresholds, setThresholds] = useState<string[]>(['', '', '', ''])
  const [alertEmail, setAlertEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api
      .get<{ resolved: Record<string, number> }>('/admin/commercial-config')
      .then((r) => {
        if (!active) return
        setTier(String(r.resolved[TIER_KEY] ?? 3))
        setThresholds(THRESHOLD_KEYS.map((k) => String(r.resolved[k] ?? '')))
        setAlertEmail(String(r.resolved[ALERT_EMAIL_KEY] ?? ''))
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load review settings.')
      })
    return () => {
      active = false
    }
  }, [])

  const numbers = thresholds.map(Number)
  const thresholdsValid = numbers.every((n) => Number.isFinite(n) && n > 0)
  // Out-of-order boundaries would silently mis-tier every new campaign, because
  // the tier is "how many boundaries the goal exceeds".
  const ascending = numbers.every((n, i) => i === 0 || n > numbers[i - 1])
  const trimmedEmail = alertEmail.trim()
  // Empty is valid: it is how the alerts are switched off.
  const emailValid = !trimmedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  const invalid = !thresholdsValid || !ascending || !emailValid

  async function save() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.put(`/admin/commercial-config/${TIER_KEY}`, {
        value: Number(tier),
        reason: 'Campaign auto-approval updated from platform settings',
      })
      for (const [i, key] of THRESHOLD_KEYS.entries()) {
        await api.put(`/admin/commercial-config/${key}`, {
          value: numbers[i],
          reason: 'Campaign tier threshold updated from platform settings',
        })
      }
      await api.put(`/admin/commercial-config/${ALERT_EMAIL_KEY}`, {
        value: trimmedEmail,
        reason: 'Review alert recipient updated from platform settings',
      })
      setMessage(
        trimmedEmail
          ? `Saved. New campaigns use these rules, and held ones are announced to ${trimmedEmail}. Anything already waiting still needs approving.`
          : 'Saved. Review alert emails are off — held campaigns will wait unannounced.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save review settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3, my: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
      <Typography variant="h6">Campaign review</Typography>
      <Typography variant="body2" sx={{ my: 2 }}>
        Goals above GHS 250,000 require staff approval unless the organizer has current approved
        identity verification (business verification for organizations) and an earlier published
        campaign. Draft, pending and blocked campaigns do not qualify. The tier settings below
        apply to goals up to GHS 250,000; they cannot waive the higher-goal rule. Plan and compliance
        limits still apply. Changes affect new campaigns only.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <TextField
        select
        label="Tier rule up to GHS 250,000"
        value={tier}
        onChange={(e) => setTier(e.target.value)}
        disabled={!canEdit || busy}
        sx={{ minWidth: 260, mb: 2, display: 'block' }}
      >
        {TIER_CHOICES.map((choice) => (
          <MenuItem key={choice.value} value={String(choice.value)}>
            {choice.label}
          </MenuItem>
        ))}
      </TextField>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
        {thresholds.map((value, i) => (
          <TextField
            key={THRESHOLD_KEYS[i]}
            label={`Tier ${i + 1} ceiling (GH₵)`}
            type="number"
            value={value}
            onChange={(e) =>
              setThresholds((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
            }
            disabled={!canEdit || busy}
            slotProps={{ htmlInput: { min: 1, step: 1000 } }}
          />
        ))}
      </Box>
      <TextField
        label="Send review alerts to"
        type="email"
        value={alertEmail}
        onChange={(e) => setAlertEmail(e.target.value)}
        disabled={!canEdit || busy}
        error={!emailValid}
        helperText={
          !emailValid
            ? 'Enter a valid email address, or clear the field to turn alerts off.'
            : 'Emailed whenever a campaign is held for review. Leave blank to turn these off.'
        }
        sx={{ minWidth: 320, mt: 1, mb: 1, display: 'block' }}
      />
      {!ascending && thresholdsValid && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Each ceiling must be larger than the one before it.
        </Alert>
      )}
      <Button onClick={() => void save()} disabled={!canEdit || busy || invalid || !tier}>
        Save review settings
      </Button>
    </Box>
  )
}
