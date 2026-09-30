import TextField from '@/components/AdminTextField'
import { useEffect, useId, useState } from 'react'
import { Alert, Box, Button, FormControlLabel, MenuItem, Skeleton, Stack, Switch, Typography } from '@mui/material'
import { api } from '@/lib/api'

type Setting =
  | { key: string; kind: 'switch'; label: string; help: string }
  | { key: string; kind: 'number'; label: string; help: string; min: number; max: number; unit?: string }
  | { key: string; kind: 'level'; label: string; help: string }

interface Group {
  /** Short name used in the Save button and the loading label. */
  name: string
  title: string
  intro: string
  /** Shown above the rows. */
  notice?: string
  settings: Setting[]
  /** A combination of values that can be saved but deserves a warning. */
  warning?: (values: Record<string, string>) => string
  /** The confirmation after the given keys were saved. */
  savedMessage: (keys: string[]) => string
}

/** Copied onto each campaign when it is created, so a change only reaches newer campaigns. */
const CREATION_SWITCHES = [
  'onBehalf.publicationRequiresConsent',
  'onBehalf.donationsRequireConsent',
  'onBehalf.staffReviewRequired',
]

const APPLIES_NOW = 'Saved. The new values apply from now on.'

const GROUPS: Group[] = [
  {
    name: 'on-behalf',
    title: 'Campaigns on behalf of others',
    intro:
      'Rules for campaigns an organizer runs for another person or organization. The beneficiary is invited by email and has to accept before anyone can request a payout.',
    notice:
      'The three switches below are copied onto each campaign when it is created, so a change applies only to campaigns created afterwards.',
    settings: [
      { key: 'onBehalf.publicationRequiresConsent', kind: 'switch', label: 'Publish only after the beneficiary accepts', help: 'Staff cannot publish the campaign until the beneficiary accepts it.' },
      { key: 'onBehalf.donationsRequireConsent', kind: 'switch', label: 'Take donations only after the beneficiary accepts', help: 'Donations stay closed until the beneficiary accepts, even while the campaign is live.' },
      { key: 'onBehalf.staffReviewRequired', kind: 'switch', label: 'Staff review every campaign on behalf of others', help: 'Each one waits for a staff decision, whatever its goal or tier.' },
      { key: 'onBehalf.invitationTtlHours', kind: 'number', min: 1, max: 720, unit: 'hours', label: 'Invitation lifetime (hours)', help: 'How long the invitation link emailed to the beneficiary stays valid.' },
      { key: 'onBehalf.minManagerVerificationLevel', kind: 'level', label: 'Minimum verification of the organizer', help: 'The verification the creating account needs before it can start one.' },
    ],
    savedMessage: (keys) =>
      keys.some((key) => CREATION_SWITCHES.includes(key))
        ? 'Saved. The consent and review switches apply to campaigns created from now on; earlier campaigns keep the rules they started with.'
        : APPLIES_NOW,
  },
  {
    name: 'thank-you',
    title: 'Donor thank-you messages',
    intro:
      'One email from the organizer or a consenting beneficiary to everyone who gave. Ujimora sends it; authors never see who received it.',
    settings: [
      { key: 'thankYou.enabled', kind: 'switch', label: 'Allow thank-you messages', help: 'Turn this off to stop anyone sending a new thank-you message.' },
      { key: 'thankYou.afterCampaignEnd', kind: 'switch', label: 'Unlock when the campaign ends', help: 'The thank-you becomes available once the campaign’s end date has passed.' },
      { key: 'thankYou.afterPayoutPaid', kind: 'switch', label: 'Unlock after a payout is paid', help: 'The thank-you becomes available once any payout from the campaign has been paid.' },
      { key: 'thankYou.maxSendsPerCampaign', kind: 'number', min: 1, max: 10, label: 'Thank-you messages per campaign', help: 'How many completion thank-yous each campaign may send.' },
    ],
    warning: (values) =>
      values['thankYou.enabled'] === '1' && values['thankYou.afterCampaignEnd'] === '0' && values['thankYou.afterPayoutPaid'] === '0'
        ? 'With both unlock switches off, no campaign can send a thank-you message.'
        : '',
    savedMessage: () => APPLIES_NOW,
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

interface Loaded {
  resolved: Record<string, number>
  defaults: Record<string, number>
}

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

/** One policy card, like its Campaign review sibling: its own rows, feedback and Save, which writes only its changed keys. */
function SettingsGroupPanel({ group, loaded, canEdit }: { group: Group; loaded: Loaded; canEdit: boolean }) {
  const idPrefix = useId()
  const headingId = `${idPrefix}-heading`
  const [saved, setSaved] = useState(() => Object.fromEntries(group.settings.map((setting) => [setting.key, loaded.resolved[setting.key]])))
  const [values, setValues] = useState(() => Object.fromEntries(group.settings.map((setting) => [setting.key, String(loaded.resolved[setting.key])])))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const invalid = group.settings.some((setting) => numberInvalid(setting, values[setting.key] ?? ''))
  const changes = group.settings
    .filter((setting) => Number(values[setting.key]) !== saved[setting.key])
    .map((setting) => ({ key: setting.key, value: Number(values[setting.key]) }))
  const warning = group.warning?.(values) ?? ''

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
      setMessage(group.savedMessage(changes.map((change) => change.key)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save these settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
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
      <Typography id={headingId} variant="h6">{group.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
        {group.intro}
      </Typography>
      {group.notice && <Alert severity="info" sx={{ mb: 2 }}>{group.notice}</Alert>}
      {group.settings.map((setting, index) => {
        const helpId = `${idPrefix}-${setting.key}`
        const raw = values[setting.key] ?? ''
        const byDefault = describeDefault(setting, loaded.defaults[setting.key])
        const help = `${setting.help}${byDefault ? ` Default: ${byDefault}.` : ''}`
        return (
          // Rules only between rows: the intro or notice already opens the list.
          <Box key={setting.key} sx={{ pt: index ? 1.5 : 0, pb: 1.5, ...(index > 0 && { borderTop: '1px solid', borderColor: 'divider' }) }}>
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
      {warning && <Alert severity="warning" sx={{ mt: 1 }}>{warning}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      <Button sx={{ mt: 2 }} onClick={() => void save()} disabled={!canEdit || busy || invalid || changes.length === 0}>
        {busy ? 'Saving…' : `Save ${group.name} settings`}
      </Button>
    </Box>
  )
}

/**
 * Campaigns on behalf of others and donor thank-you messages, one card per
 * policy with its own Save. Values live in the versioned commercial-config
 * store (the audit trail), and only changed keys are written so each key's
 * history shows real changes.
 */
export function OnBehalfThankYouSettings({ canEdit }: { canEdit: boolean }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  function reload() {
    setLoading(true)
    setError('')
    setRetry((value) => value + 1)
  }

  useEffect(() => {
    let active = true
    api
      .get<{ resolved: Record<string, unknown>; defaults?: Record<string, unknown> }>('/admin/commercial-config')
      .then((r) => {
        if (!active) return
        if (SETTINGS.some((setting) => typeof r.resolved?.[setting.key] !== 'number')) {
          setError('This server does not offer these settings yet.')
          return
        }
        setLoaded({
          resolved: Object.fromEntries(SETTINGS.map((setting) => [setting.key, r.resolved[setting.key] as number])),
          defaults: Object.fromEntries(
            SETTINGS.filter((setting) => typeof r.defaults?.[setting.key] === 'number').map((setting) => [
              setting.key,
              r.defaults![setting.key] as number,
            ]),
          ),
        })
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

  if (loading)
    return (
      <>
        {GROUPS.map((group) => (
          <Stack key={group.name} aria-label={`Loading ${group.name} settings`} spacing={2} sx={{ p: 3, my: 3 }}>
            <Skeleton width="45%" height={32} />
            <Skeleton width="90%" />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton width={180} height={48} />
          </Stack>
        ))}
      </>
    )
  if (!loaded)
    return (
      <Alert
        severity="error"
        sx={{ my: 3 }}
        action={<Button onClick={reload}>Retry</Button>}
      >
        {error || 'Could not load these settings.'}
      </Alert>
    )

  return (
    <>
      {GROUPS.map((group) => (
        <SettingsGroupPanel key={group.name} group={group} loaded={loaded} canEdit={canEdit} />
      ))}
    </>
  )
}
