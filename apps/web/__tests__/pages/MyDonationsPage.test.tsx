import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { PaymentMethod } from '@ubuntu-fund/types'
import type { UserDonation } from '@/hooks/useDonations'

const donations: UserDonation[] = [
  { id: '1', campaignId: 'c1', campaignName: 'Clinic appeal', amount: 50, currency: 'GHS', date: '2025-01-01', status: 'completed', paymentMethod: PaymentMethod.CARD },
  { id: '2', campaignId: 'c2', campaignName: 'School appeal', amount: 20, currency: 'GHS', date: '2025-01-02', status: 'pending', paymentMethod: PaymentMethod.MOBILE_MONEY },
]
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@/hooks/useDonations', () => ({ useMyDonations: () => ({ donations, isLoading: false, error: null }) }))

import { MyDonationsPage } from '@/pages/MyDonationsPage'

function renderPage() {
  return render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><MyDonationsPage /></MemoryRouter></ThemeProvider>)
}

function field(label: string) {
  const combobox = screen.getByRole('combobox', { name: new RegExp(label) })
  const root = combobox.closest('.MuiInputBase-root') as HTMLElement
  return { combobox, adornmentIcons: root.querySelectorAll('.MuiInputAdornment-root svg') }
}

it('lists each filter option with an icon and shows one icon plus the label when closed', () => {
  renderPage()

  const status = field('Status')
  expect(status.combobox.textContent).toBe('All Statuses')
  expect(status.combobox.querySelector('svg')).toBeNull()
  expect(status.adornmentIcons).toHaveLength(1)
  expect(status.adornmentIcons[0]).toHaveAttribute('data-testid', 'TuneRoundedIcon')

  fireEvent.mouseDown(status.combobox)
  const statusOptions = within(screen.getByRole('listbox')).getAllByRole('option')
  expect(statusOptions.map((o) => o.textContent)).toEqual(['All Statuses', 'Completed', 'Pending', 'Partially refunded', 'Refunded'])
  statusOptions.forEach((o) => expect(o.querySelector('.MuiListItemIcon-root svg')).not.toBeNull())
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Pending' }))

  const pending = field('Status')
  expect(pending.combobox.textContent).toBe('Pending')
  expect(pending.adornmentIcons).toHaveLength(1)
  expect(pending.adornmentIcons[0]).toHaveAttribute('data-testid', 'HourglassTopRoundedIcon')
  expect(screen.getByText('School appeal')).toBeInTheDocument()
  expect(screen.queryByText('Clinic appeal')).not.toBeInTheDocument()
})

it('filters by payment method with the method icon in the closed field', () => {
  renderPage()

  const method = field('Payment Method')
  expect(method.combobox.textContent).toBe('All Methods')
  fireEvent.mouseDown(method.combobox)
  const methodOptions = within(screen.getByRole('listbox')).getAllByRole('option')
  expect(methodOptions.map((o) => o.textContent)).toEqual(['All Methods', 'Mobile Money', 'Card', 'Bank Transfer', 'Wallet', 'Crypto'])
  methodOptions.forEach((o) => expect(o.querySelector('.MuiListItemIcon-root svg')).not.toBeNull())
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Card' }))

  const card = field('Payment Method')
  expect(card.combobox.textContent).toBe('Card')
  expect(card.adornmentIcons).toHaveLength(1)
  expect(card.adornmentIcons[0]).toHaveAttribute('data-testid', 'CreditCardRoundedIcon')
  expect(screen.getByText('Clinic appeal')).toBeInTheDocument()
  expect(screen.queryByText('School appeal')).not.toBeInTheDocument()
})
