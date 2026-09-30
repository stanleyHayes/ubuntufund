import TextField from '@/components/AdminTextField'
import { useEffect, useId, useState } from 'react'
import { Alert, Box, Button, FormControlLabel, MenuItem, Skeleton, Stack, Switch, Typography } from '@mui/material'
import { api } from '@/lib/api'

type Setting =
  | { key: string; kind: 'switch'; label: string; help: string }
  | { key: string; kind: 'number'; label: string; help: string; min: number; max: number; unit?: string }
  | { key: string; kind: 'level'; label: string; help: string }

/** Copied onto each campaign when it is created, so a change only reaches newer campaigns. */
const CREATION_SWITCHES = [
  'onBehalf.publicationRequiresConsent',
  'onBehalf.donationsRequireConsent',
  'onBehalf.staffReviewRequired',
]

const GROUPS: { title: string; intro: string; settings: Setting[] }[] = [
  {
    title: 'Campaigns on behalf of others',
    intro:
      'Rules for campaigns an organizer runs for another person or organization. The beneficiary is invited by email and has to accept before anyone can request a payout.',
    settings: [
      { key: 'onBehalf.publicationRequiresConsent', kind: 'switch', label: 'Publish only after the beneficiary accepts', help: 'Staff cannot publish the campaign until the beneficiary accepts it.' },
      { key: 'onBehalf.donationsRequireConsent', kind: 'switch', label: 'Take donations only after the beneficiary accepts', help: 'Donations stay closed until the beneficiary accepts, even while the campaign is live.' },
      { key: 'onBehalf.staffReviewRequired', kind: 'switch', label: 'Staff review every campaign on behalf of others', help: 'Each one waits for a staff decision, whatever its goal or tier.' },
      { key: 'onBehalf.invitationTtlHours', kind: 'number', min: 1, max: 720, unit: 'hours', label: 'Invitation lifetime (hours)', help: 'How long the invitation link emailed to the beneficiary stays valid.' },
      { key: 'onBehalf.minManagerVerificationLevel', kind: 'level', label: 'Minimum verification of the organizer', help: 'The verification the creating account needs before it can start one.' },
    ],
  },
  {
    title: 'Donor thank-you messages',
    intro:
      'One email from the organizer or a consenting beneficiary to everyone who gave. Ujimora sends it; authors never see who received it.',
    settings: [
      { key: 'thankYou.enabled', kind: 'switch', label: 'Allow thank-you messages', help: 'Turn this off to stop anyone sending a new thank-you message.' },
      { key: 'thankYou.afterCampaignEnd', kind: 'switch', label: 'Unlock when the campaign ends', help: 'The thank-you becomes available once the campaign’s end date has passed.' },
      { key: 'thankYou.afterPayoutPaid', kind: 'switch', label: 'Unlock after a payout is paid', help: 'The thank-you becomes available once any payout from the campaign has been paid.' },
      { key: 'thankYou.maxSendsPerCampaign', kind: 'number', min: 1, max: 10, label: 'Thank-you messages per campaign', help: 'How many completion thank-yous each campaign may send.' },
    ],
  },
]

const SETTINGS = GROUPS.flatMap((group) => group.settings)

const LEVELS = [
  { value: 0, label: 'Level 0 · Normal campaign rules' },
  { value: 1, label: 'Level 1 · Email and phone' },
  { value: 2, label: 'Level 2 · National ID' },
  { value: 3, label: 'Level 3 · Institutional' },
  { value: 4, label: 'Level 4 · Community' },
]

const REASON = 'Campaigns on behalf of others and donor thank-you settings updated from platform settings'

function numberInvalid(setting: Setting, raw: string): boolean {
  if (setting.kind !== 'number') return false
  const value = Number(raw)
  return raw.trim() === '' || !Number.isInteger(value) || value < setting.min || value > setting.max
}

function describeDefault(setting: Setting, value: number | undefined): string {
  if (value === undefined) return ''
  if (setting.kind === 'switch') return value === 1 ? 'on' : 'off'
  if (setting.kind === 'level') return `level ${value}`
  return setting.unit ? `${value} ${setting.unit}` : String(value)
}

/**
 * Campaigns on behalf of others and donor thank-you messages. Values live in
 * the versioned commercial-config store (the audit trail), and only changed
 * keys are written so each key's history shows real changes.
 */
export function OnBehalfThankYouSettings({ canEdit }: { canEdit: boolean }) {
  const idPrefix = useId()
  const [saved, setSaved] = useState<Record<string, number> | null>(null)
  const [defaults, setDefaults] = useState<Record<string, number>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .get<{ resolved: Record<string, unknown>; defaults?: Record<string, unknown> }>('/admin/commercial-config')
      .then((r) => {
        if (!active) return
        if (SETTINGS.some((setting) => typeof r.resolved?.[setting.key] !== 'number')) {
          setError('This server does not offer these settings yet.')
          return
        }
        const current = Object.fromEntries(SETTINGS.map((setting) => [setting.key, r.resolved[setting.key] as number]))
        setSaved(current)
        setValues(Object.fromEntries(SETTINGS.map((setting) => [setting.key, String(current[setting.key])])))
        setDefaults(
          Object.fromEntries(
            SETTINGS.filter((setting) => typeof r.defaults?.[setting.key] === 'number').map((setting) => [
              setting.key,
              r.defaults![setting.key] as number,
            ]),
          ),
        )
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load these settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])

  const invalid = SETTINGS.some((setting) => numberInvalid(setting, values[setting.key] ?? ''))
  const changes = saved
    ? SETTINGS.filter((setting) => Number(values[setting.key]) !== saved[setting.key]).map((setting) => ({
        key: setting.key,
        value: Number(values[setting.key]),
      }))
    : []
  const neverUnlocks =
    values['thankYou.enabled'] === '1' &&
    values['thankYou.afterCampaignEnd'] === '0' &&
    values['thankYou.afterPayoutPaid'] === '0'

  function update(key: string, value: string) {
    setMessage('')
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (!changes.length || invalid) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.put('/admin/commercial-config', { changes, reason: REASON })
      setSaved((current) => ({ ...current, ...Object.fromEntries(changes.map((change) => [change.key, change.value])) }))
      setMessage(
        changes.some((change) => CREATION_SWITCHES.includes(change.key))
          ? 'Saved. The consent and review switches apply to campaigns created from now on; earlier campaigns keep the rules they started with.'
          : 'Saved. The new values apply from now on.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save these settings.')
    } finally {
      setBusy(false)
    }
  }

  if (loading)
    return (
      <Stack aria-label="Loading on-behalf and thank-you settings" spacing={2} sx={{ p: 3, my: 3 }}>
        <Skeleton width="45%" height={32} />
        <Skeleton width="90%" />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton width={180} height={48} />
      </Stack>
    )
  if (error && !saved)
    return (
      <Alert
        severity="error"
        sx={{ my: 3 }}
        action={<Button onClick={() => setRetry((value) => value + 1)}>Retry</Button>}
      >
        {error}
      </Alert>
    )

  return (
    <Box
      component="section"
      aria-label="Campaigns on behalf of others and donor thank-you settings"
      sx={{
        p: { xs: 2, sm: 3 },
        my: 3,
        boxShadow: 'var(--neu-raised)',
        borderRadius: 3,
        bgcolor: 'background.paper',
        minWidth: 0,
        overflowWrap: 'anywhere',
      }}
    >
      {GROUPS.map((group, groupIndex) => (
        <Box key={group.title} sx={{ mt: groupIndex ? 4 : 0 }}>
          <Typography variant="h6">{group.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            {group.intro}
          </Typography>
          {groupIndex === 0 && (
            <Alert severity="info" sx={{ mb: 1 }}>
              The three switches below are copied onto each campaign when it is created, so a change applies only to
              campaigns created afterwards.
            </Alert>
          )}
          {group.settings.map((setting) => {
            const helpId = `${idPrefix}-${setting.key}`
            const raw = values[setting.key] ?? ''
            const byDefault = describeDefault(setting, defaults[setting.key])
            const help = `${setting.help}${byDefault ? ` Default: ${byDefault}.` : ''}`
            return (
              <Box key={setting.key} sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                {setting.kind === 'switch' ? (
                  <>
                    <FormControlLabel
                      label={setting.label}
                      control={
                        <Switch
                          checked={raw === '1'}
                          disabled={!canEdit || busy}
                          onChange={(_, checked) => update(setting.key, checked ? '1' : '0')}
                          slotProps={{ input: { role: 'switch', 'aria-describedby': helpId } }}
                        />
                      }
                    />
                    <Typography id={helpId} variant="body2" color="text.secondary">
                      {help}
                    </Typography>
                  </>
                ) : setting.kind === 'level' ? (
                  <TextField
                    optionContext="verification-level"
                    select
                    fullWidth
                    label={setting.label}
                    value={raw}
                    onChange={(e) => update(setting.key, e.target.value)}
                    disabled={!canEdit || busy}
                    helperText={help}
                    sx={{ minWidth: 0, display: 'block' }}
                  >
                    {LEVELS.map((level) => (
                      <MenuItem key={level.value} value={String(level.value)}>
                        {level.label}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    fullWidth
                    type="number"
                    label={setting.label}
                    value={raw}
                    onChange={(e) => update(setting.key, e.target.value)}
                    disabled={!canEdit || busy}
                    error={numberInvalid(setting, raw)}
                    helperText={
                      numberInvalid(setting, raw)
                        ? `Use a whole number from ${setting.min} to ${setting.max}.`
                        : `${help} Allowed: ${setting.min}–${setting.max}.`
                    }
                    slotProps={{ htmlInput: { min: setting.min, max: setting.max, step: 1 } }}
                  />
                )}
              </Box>
            )
          })}
        </Box>
      ))}
      {neverUnlocks && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          With both unlock switches off, no campaign can send a thank-you message.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      <Button
        sx={{ mt: 2 }}
        onClick={() => void save()}
        disabled={!canEdit || busy || invalid || changes.length === 0}
      >
        {busy ? 'Saving…' : 'Save on-behalf and thank-you settings'}
      </Button>
    </Box>
  )
}
