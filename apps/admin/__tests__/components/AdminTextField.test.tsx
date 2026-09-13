import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MenuItem, Checkbox, ListItemText } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import TextField, { AdminSelect } from '@/components/AdminTextField'

it('describes choices while preserving raw status values and disabled options', () => {
  const onChange = vi.fn()
  render(<ThemeProvider theme={ujimoraTheme}><TextField select label="Status" optionContext="campaign" value="draft" onChange={onChange}><MenuItem value="draft">draft</MenuItem><MenuItem value="pending_review">pending review</MenuItem><MenuItem value="active" disabled>active</MenuItem></TextField></ThemeProvider>)
  expect(screen.getByRole('combobox')).toHaveTextContent('Draft')
  expect(screen.getByRole('combobox')).not.toHaveTextContent('Saved for editing')
  fireEvent.mouseDown(screen.getByRole('combobox'))
  expect(screen.getByRole('option', { name: 'Pending review' })).toHaveAccessibleDescription('Submitted for staff review before publication.')
  expect(screen.getByRole('option', { name: 'Active' })).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(screen.getByRole('option', { name: 'Pending review' }))
  expect(onChange.mock.calls[0][0].target.value).toBe('pending_review')
})
it('retains coupon checkbox selection and the caller’s compact multi-select summary', () => {
  function Field() {
    const [value, setValue] = useState<string[]>([])
    return <AdminSelect multiple value={value} displayEmpty optionContext="coupon" renderValue={values => values.length ? values.join(', ') : 'All tiers'} onChange={event => setValue(event.target.value as string[])}>
      {['starter', 'pro'].map(tier => <MenuItem key={tier} value={tier}><Checkbox checked={value.includes(tier)} /><ListItemText primary={tier === 'starter' ? 'Plus' : 'Pro'} /></MenuItem>)}
    </AdminSelect>
  }
  render(<ThemeProvider theme={ujimoraTheme}><Field /></ThemeProvider>)
  const field = screen.getByRole('combobox')
  fireEvent.mouseDown(field)
  expect(screen.getByRole('option', { name: 'Plus' })).toHaveAccessibleDescription('Members on the Plus subscription tier.')
  fireEvent.click(screen.getByRole('option', { name: 'Plus' }))
  expect(field).toHaveTextContent('starter')
  expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
  fireEvent.click(screen.getByRole('option', { name: 'Pro' }))
  expect(field).toHaveTextContent('starter, pro')
  fireEvent.click(screen.getByRole('option', { name: 'Plus' }))
  expect(field).toHaveTextContent('pro')
})
