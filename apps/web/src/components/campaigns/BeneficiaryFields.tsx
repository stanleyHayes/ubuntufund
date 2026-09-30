import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import type { SxProps, Theme } from '@mui/material/styles'
import { useId } from 'react'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import type { BeneficiaryPartyType, BeneficiaryRelationship, OnBehalfPayoutArrangement } from '@ubuntu-fund/types'
import { BENEFICIARY_LIMITS, RELATIONSHIP_OPTIONS, type BeneficiaryDraft, type BeneficiaryErrors, type BeneficiaryField } from '@/lib/onBehalf'

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
      <FormControl disabled={disabled}>
        <FormLabel id={`${id}-type`} sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Is the beneficiary a person or an organization?</FormLabel>
        <RadioGroup row aria-labelledby={`${id}-type`} value={value.beneficiaryType} onChange={(_, next) => set('beneficiaryType', next as BeneficiaryPartyType)}>
          <FormControlLabel value="individual" control={<Radio />} label="A person" />
          <FormControlLabel value="organization" control={<Radio />} label="An organization" />
        </RadioGroup>
      </FormControl>
      <TextField
        label={value.beneficiaryType === 'organization' ? 'Organization’s public name' : 'Their public name'}
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
      <FormControl disabled={disabled}>
        <FormLabel id={`${id}-payout`} sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Who receives the money?</FormLabel>
        <RadioGroup aria-labelledby={`${id}-payout`} aria-describedby={`${id}-payout-help`} value={value.payoutArrangement} onChange={(_, next) => set('payoutArrangement', next as OnBehalfPayoutArrangement)}>
          <FormControlLabel value="beneficiary" control={<Radio />} label="The beneficiary, into their own verified account" />
          <FormControlLabel value="organization" control={<Radio />} label={`${organizationLabel}, on their behalf — only if they agree`} />
        </RadioGroup>
        <FormHelperText id={`${id}-payout-help`} sx={{ mx: 0 }}>
          {value.payoutArrangement === 'organization'
            ? 'They see this when they accept. Until they agree, nobody can request payouts.'
            : 'You manage the campaign. Only the beneficiary can request payouts, after they accept.'}
        </FormHelperText>
      </FormControl>
    </Box>
  )
}
