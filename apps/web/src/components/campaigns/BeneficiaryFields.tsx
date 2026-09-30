import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import { useId } from 'react'
import { BrandedTextField as TextField, SHAPE } from '@ubuntu-fund/ui'
import type { BeneficiaryPartyType, BeneficiaryRelationship, OnBehalfPayoutArrangement } from '@ubuntu-fund/types'
import { BENEFICIARY_LIMITS, RELATIONSHIP_OPTIONS, type BeneficiaryDraft, type BeneficiaryErrors, type BeneficiaryField } from '@/lib/onBehalf'

/**
 * One option in a card-style radio group: the same recipe as the collaborator
 * role picker, so every skin paints it as a raised card that presses in once
 * chosen.
 */
function OptionCard({ value, label, selected, disabled }: { value: string; label: string; selected: boolean; disabled: boolean }) {
  return (
    <FormControlLabel
      value={value}
      labelPlacement="start"
      control={<Radio size="small" sx={{ p: 0.5, ml: 1, alignSelf: 'center' }} />}
      sx={{ m: 0, p: { xs: 1.5, sm: 2 }, minWidth: 0, borderRadius: SHAPE.sm, bgcolor: 'var(--neu-surface)', backdropFilter: 'var(--neu-backdrop)', boxShadow: selected ? 'var(--neu-inset)' : 'var(--neu-raised)', border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', transition: 'box-shadow 160ms ease, border-color 160ms ease', '&:has(input:focus-visible)': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 }, '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 }, '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}
      label={<Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography sx={{ fontWeight: 750, color: disabled ? 'text.disabled' : 'text.primary' }}>{label}</Typography>
      </Box>}
    />
  )
}

/**
 * Who a campaign is for: used when creating a campaign on someone's behalf and
 * when the organizer changes the beneficiary before they accept.
 */
export function BeneficiaryFields({ value, onChange, errors, touched, onBlur, organizationLabel, fieldSx, disabled = false }: {
  value: BeneficiaryDraft
  onChange: (value: BeneficiaryDraft) => void
  errors: BeneficiaryErrors
  touched: Partial<Record<BeneficiaryField, boolean>>
  onBlur: (field: BeneficiaryField) => void
  /** How the creating account is named in the payout choice, e.g. "My organization". */
  organizationLabel: string
  fieldSx?: SxProps<Theme>
  disabled?: boolean
}) {
  const id = useId()
  const set = <K extends keyof BeneficiaryDraft>(key: K, next: BeneficiaryDraft[K]) => onChange({ ...value, [key]: next })
  const shown = (field: BeneficiaryField) => Boolean(touched[field] && errors[field])
  const helper = (field: BeneficiaryField, fallback: string) => (shown(field) ? errors[field] : fallback)
  const reasonLength = value.reason.trim().length
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <FormLabel component="legend" id={`${id}-type`} sx={{ color: 'text.primary', fontWeight: 700, mb: 1.5 }}>Is the beneficiary a person or an organization?</FormLabel>
        <RadioGroup aria-labelledby={`${id}-type`} value={value.beneficiaryType} onChange={(_, next) => set('beneficiaryType', next as BeneficiaryPartyType)} sx={{ gap: 1.5 }}>
          <OptionCard value="individual" label="A person" selected={value.beneficiaryType === 'individual'} disabled={disabled} />
          <OptionCard value="organization" label="An organization" selected={value.beneficiaryType === 'organization'} disabled={disabled} />
        </RadioGroup>
      </FormControl>
      <TextField
        label={value.beneficiaryType === 'organization' ? 'Organization’s public name' : 'Their public name'}
        placeholder={value.beneficiaryType === 'organization' ? 'e.g. Osu Community Clinic' : 'e.g. Kofi Boateng'}
        value={value.beneficiaryName}
        onChange={(event) => set('beneficiaryName', event.target.value)}
        onBlur={() => onBlur('beneficiaryName')}
        error={shown('beneficiaryName')}
        helperText={helper('beneficiaryName', 'Shown publicly on the campaign page.')}
        disabled={disabled}
        fullWidth
        sx={fieldSx}
        slotProps={{ htmlInput: { maxLength: BENEFICIARY_LIMITS.name } }}
      />
      <TextField
        label="Their email address"
        type="email"
        autoComplete="off"
        placeholder="e.g. kofi@example.com"
        value={value.beneficiaryEmail}
        onChange={(event) => set('beneficiaryEmail', event.target.value)}
        onBlur={() => onBlur('beneficiaryEmail')}
        error={shown('beneficiaryEmail')}
        helperText={helper('beneficiaryEmail', 'We email them an invitation to accept. Donors never see this address.')}
        disabled={disabled}
        fullWidth
        sx={fieldSx}
        slotProps={{ htmlInput: { maxLength: BENEFICIARY_LIMITS.email } }}
      />
      <TextField
        select
        label="Their relationship to you"
        value={value.relationship}
        onChange={(event) => set('relationship', event.target.value as BeneficiaryRelationship)}
        onBlur={() => onBlur('relationship')}
        error={shown('relationship')}
        helperText={helper('relationship', 'How you know the person or organization you are raising money for.')}
        disabled={disabled}
        fullWidth
        sx={fieldSx}
      >
        {RELATIONSHIP_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </TextField>
      <TextField
        label="Why are you raising money for them?"
        placeholder="e.g. He is my nephew and his family cannot cover his final-year fees."
        value={value.reason}
        onChange={(event) => set('reason', event.target.value)}
        onBlur={() => onBlur('reason')}
        error={shown('reason')}
        helperText={helper('reason', `${reasonLength}/${BENEFICIARY_LIMITS.reason} · The beneficiary and our review team see this. Donors do not.`)}
        disabled={disabled}
        fullWidth
        multiline
        minRows={3}
        sx={fieldSx}
        slotProps={{ htmlInput: { maxLength: BENEFICIARY_LIMITS.reason } }}
      />
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <FormLabel component="legend" id={`${id}-payout`} sx={{ color: 'text.primary', fontWeight: 700, mb: 1.5 }}>Who receives the money?</FormLabel>
        <RadioGroup aria-labelledby={`${id}-payout`} aria-describedby={`${id}-payout-help`} value={value.payoutArrangement} onChange={(_, next) => set('payoutArrangement', next as OnBehalfPayoutArrangement)} sx={{ gap: 1.5 }}>
          <OptionCard value="beneficiary" label="The beneficiary, into their own verified account" selected={value.payoutArrangement === 'beneficiary'} disabled={disabled} />
          <OptionCard value="organization" label={`${organizationLabel}, on their behalf — only if they agree`} selected={value.payoutArrangement === 'organization'} disabled={disabled} />
        </RadioGroup>
        <FormHelperText id={`${id}-payout-help`} sx={{ mx: 0, mt: 1 }}>
          {value.payoutArrangement === 'organization'
            ? 'They see this when they accept. Until they agree, nobody can request payouts.'
            : 'You manage the campaign. Only the beneficiary can request payouts, after they accept.'}
        </FormHelperText>
      </FormControl>
    </Box>
  )
}
