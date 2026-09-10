import { Autocomplete, TextField } from '@mui/material'
import { payoutInstitutionName } from '@ubuntu-fund/types'

type BankOption = { name: string; code: string }
export function BankPicker({
  banks,
  value,
  onChange,
  label = 'Bank or network',
  required = false,
}: {
  banks: BankOption[]
  value: string
  onChange: (code: string) => void
  label?: string
  required?: boolean
}) {
  return (
    <Autocomplete
      fullWidth
      options={banks}
      value={banks.find((bank) => bank.code === value) ?? null}
      onChange={(_, bank) => onChange(bank?.code ?? '')}
      getOptionLabel={(bank) => payoutInstitutionName(bank.name, bank.code)}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      autoHighlight
      openOnFocus
      noOptionsText="No matching banks or networks"
      slotProps={{
        listbox: {
          sx: { maxHeight: 280, '& .MuiAutocomplete-option': { py: 1.25, fontSize: '.9rem' } },
        },
        paper: {
          sx: {
            mt: 0.75,
            borderRadius: '12px !important',
            border: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder="Type to search…"
          helperText="Search by name, then choose a result."
        />
      )}
    />
  )
}
