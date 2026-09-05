import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { BrandedDatePicker, EmptyState, ujimoraTheme } from '@ubuntu-fund/ui'

afterEach(cleanup)

function wrap(child: React.ReactNode) { return <ThemeProvider theme={ujimoraTheme}>{child}</ThemeProvider> }

describe('branded calendar', () => {
  it('keeps a date-only value stable and renders an accessible calendar with range limits', () => {
    render(wrap(<BrandedDatePicker label="End date" defaultValue="2026-09-05" minDate="2026-09-05" id="end-date" />))
    expect(document.getElementById('end-date')).toHaveValue('2026-09-05')
    fireEvent.click(screen.getByRole('button', { name: /choose date/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: '4', exact: true })).toBeDisabled()
    expect(screen.getByRole('gridcell', { name: '12', exact: true })).not.toBeDisabled()
  })

  it('selects and clears without sending a localized date to the consumer', () => {
    const change = vi.fn()
    render(wrap(<BrandedDatePicker label="End date" defaultValue="2026-09-05" onChange={change} />))
    fireEvent.click(screen.getByRole('button', { name: /choose date/i }))
    fireEvent.click(screen.getByRole('gridcell', { name: '12', exact: true }))
    expect(change).toHaveBeenLastCalledWith('2026-09-12')
    if (!screen.queryByRole('button', { name: 'Clear', exact: true })) fireEvent.click(screen.getByRole('button', { name: /choose date/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }))
    expect(change).toHaveBeenLastCalledWith('')
  })

  it('preserves local hours and minutes for date-time forms', () => {
    render(wrap(<BrandedDatePicker label="End date" mode="datetime" value="2026-09-05T18:45" id="local-end" />))
    expect(document.getElementById('local-end')).toHaveValue('2026-09-05T18:45')
    expect(screen.getByRole('spinbutton', { name: /hours/i })).toHaveAttribute('aria-valuenow', '18')
  })

  it('keeps empty-state guidance and action available without relying on animation', () => {
    const action = vi.fn()
    render(wrap(<EmptyState compact variant="noData" title="No updates yet" description="Share your first milestone." action={<button onClick={action}>Add update</button>} />))
    expect(screen.getByText('Share your first milestone.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Add update' }))
    expect(action).toHaveBeenCalledOnce()
  })
})
