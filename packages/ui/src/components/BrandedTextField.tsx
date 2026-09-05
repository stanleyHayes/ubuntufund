import { forwardRef, useState } from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import type { BaseSelectProps } from '@mui/material/Select'
import type { InputBaseProps } from '@mui/material/InputBase'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PersonOutline from '@mui/icons-material/PersonOutline'
import BusinessOutlined from '@mui/icons-material/BusinessOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import PhoneOutlined from '@mui/icons-material/PhoneOutlined'
import NotesOutlined from '@mui/icons-material/NotesOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import TagOutlined from '@mui/icons-material/TagOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'

/** Existing adornments take precedence, including currency units and search controls. */
export const BrandedTextField = forwardRef<HTMLDivElement, TextFieldProps>(function BrandedTextField(props, ref) {
  const [showPassword, setShowPassword] = useState(false)
  const hint = [props.type, props.name, props.id, typeof props.label === 'string' ? props.label : '', props.placeholder].filter(Boolean).join(' ').toLowerCase()
  const FieldIcon = /password|secret/.test(hint) ? LockOutlined
    : /email/.test(hint) ? EmailOutlined
    : /search/.test(hint) ? SearchOutlined
    : /phone|mobile number|telephone/.test(hint) ? PhoneOutlined
    : /url|website|link/.test(hint) ? LinkOutlined
    : /amount|price|goal|fee|balance|budget|cost|commission/.test(hint) ? PaymentsOutlined
    : /country|city|address|street|location|nationality/.test(hint) ? PlaceOutlined
    : /organization|company|business/.test(hint) ? BusinessOutlined
    : /name|beneficiary|recipient/.test(hint) ? PersonOutline
    : /code|number|slug|reference/.test(hint) ? TagOutlined
    : props.select ? TuneOutlined : NotesOutlined
  const label = typeof props.label === 'string' ? props.label.replace(/\s*\*$/, '').trim().toLowerCase() : ''
  const placeholder = props.placeholder || (props.select ? `Select ${label || 'an option'}`
    : props.type === 'email' || /email/.test(label) ? 'you@example.com'
    : props.type === 'url' || /website|url/.test(label) ? 'https://example.com'
    : props.type === 'number' ? '0'
    : label ? `Enter ${label}` : props.multiline ? 'Enter details' : 'Enter a value')
  const password = props.type === 'password'
  const startAdornment = <InputAdornment position="start" sx={{ color: 'text.secondary', alignSelf: props.multiline ? 'flex-start' : undefined, mt: props.multiline ? '3px' : undefined }}><FieldIcon fontSize="small" aria-hidden="true" /></InputAdornment>
  const endAdornment = password ? <InputAdornment position="end"><IconButton
    size="small" edge="end" disabled={props.disabled}
    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
    onMouseDown={(event) => event.preventDefault()} onClick={() => setShowPassword((value) => !value)}
  >{showPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}</IconButton></InputAdornment> : undefined
  const inputSlot = props.slotProps?.input
  return <TextField {...props} placeholder={placeholder} ref={ref} type={password && showPassword ? 'text' : props.type}
    slotProps={{ ...props.slotProps,
      select: (ownerState) => {
        const slot = props.slotProps?.select
        const existing: Partial<BaseSelectProps> = { ...props.SelectProps, ...(typeof slot === 'function' ? slot(ownerState) : slot) }
        const empty = props.value === '' || (Array.isArray(props.value) && props.value.length === 0)
        return { ...existing, ...(props.select && empty && !existing.native && !existing.renderValue ? {
          displayEmpty: true,
          renderValue: () => <span style={{ color: 'var(--text-secondary, inherit)' }}>{placeholder}</span>,
        } : {}) }
      },
      inputLabel: (ownerState) => {
        const slot = props.slotProps?.inputLabel
        return { ...(props.select ? { shrink: true } : {}), ...props.InputLabelProps, ...(typeof slot === 'function' ? slot(ownerState) : slot) }
      },
      input: (ownerState) => {
      const existing: Partial<InputBaseProps> = { ...props.InputProps, ...(typeof inputSlot === 'function' ? inputSlot(ownerState) : inputSlot) }
      return { ...existing, startAdornment: existing.startAdornment !== undefined ? existing.startAdornment : startAdornment,
        endAdornment: existing.endAdornment !== undefined ? existing.endAdornment : endAdornment }
    } }} />
})
