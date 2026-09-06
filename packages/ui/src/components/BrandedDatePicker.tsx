import { useState } from 'react'
import type { TextFieldProps } from '@mui/material/TextField'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import dayjs from 'dayjs'
import 'dayjs/locale/en-gb'

export interface BrandedDatePickerProps {
  label: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  mode?: 'date' | 'datetime' | 'time'
  minDate?: string
  maxDate?: string
  id?: string
  required?: boolean
  disabled?: boolean
  error?: boolean
  helperText?: TextFieldProps['helperText']
  onBlur?: TextFieldProps['onBlur']
  fullWidth?: boolean
  size?: 'small' | 'medium'
  sx?: TextFieldProps['sx']
}

const paperSx = {
  bgcolor: 'background.paper', color: 'text.primary', backgroundImage: 'none',
  borderRadius: 'var(--shape-card)', boxShadow: 'var(--neu-raised)',
  border: '1px solid', borderColor: 'divider',
  '& .MuiPickersDay-root, & .MuiPickersDay2-root': { borderRadius: '6px 12px 6px 12px' },
  '& .Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', boxShadow: 'var(--neu-subtle)' },
  '& .MuiPickersDay-today, & .MuiPickersDay2-today': { borderColor: 'secondary.main' },
  '& .MuiPickersCalendarHeader-label': { fontWeight: 700 },
  '& .MuiPickersCalendarHeader-root': { mb: 2 },
  '& .MuiPickersDay-root:focus-visible, & .MuiPickersDay2-root:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
}

/** Values stay in local ISO form, independent of the displayed day/month order. */
export function BrandedDatePicker({ value, defaultValue = '', onChange, mode = 'date', minDate, maxDate, id, error, helperText, ...field }: BrandedDatePickerProps) {
  const [internal, setInternal] = useState(defaultValue)
  const [invalid, setInvalid] = useState(false)
  const raw = value ?? internal
  const format = mode === 'datetime' ? 'YYYY-MM-DDTHH:mm' : mode === 'time' ? 'HH:mm' : 'YYYY-MM-DD'
  const parsed = raw ? dayjs(mode === 'time' ? `2000-01-01T${raw}` : raw) : null
  const common = {
    label: field.label,
    value: parsed,
    disabled: field.disabled,
    onChange: (next: dayjs.Dayjs | null) => {
      const serialized = next?.isValid() ? next.format(format) : ''
      setInternal(serialized)
      onChange?.(serialized)
    },
    onError: (reason: unknown) => setInvalid(Boolean(reason)),
    slotProps: {
      textField: { ...field, id: id ? `${id}-display` : undefined, error: error || invalid, helperText: invalid ? 'Choose a valid date or time within the allowed range.' : helperText },
      desktopPaper: { sx: paperSx },
      mobilePaper: { sx: paperSx },
      actionBar: { actions: ['clear', 'cancel', 'accept'] as ('clear' | 'cancel' | 'accept')[] },
    },
  }
  const bounds = { minDate: minDate ? dayjs(minDate) : undefined, maxDate: maxDate ? dayjs(maxDate) : undefined }
  return <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
    {mode === 'datetime' ? <DateTimePicker {...common} {...bounds} ampm={false} format="DD/MM/YYYY HH:mm" /> : mode === 'time' ? <TimePicker {...common} ampm={false} format="HH:mm" /> : <DatePicker {...common} {...bounds} format="DD/MM/YYYY" />}
    {id && <input type="hidden" id={id} value={invalid ? '' : parsed?.isValid() ? parsed.format(format) : ''} />}
  </LocalizationProvider>
}
