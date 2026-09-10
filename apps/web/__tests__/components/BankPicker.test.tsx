import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { BankPicker } from '@/components/account/BankPicker'

it('filters banks by name and returns the provider code only on selection', async () => {
  const onChange = vi.fn()
  render(
    <BankPicker
      banks={[
        { name: 'Absa Bank Ghana', code: 'ABSA' },
        { name: 'Ecobank Ghana', code: 'ECO' },
      ]}
      value=""
      onChange={onChange}
    />,
  )
  fireEvent.focus(screen.getByRole('combobox'))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'eco' } })
  await waitFor(() =>
    expect(screen.queryByRole('option', { name: 'Absa Bank Ghana' })).not.toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole('option', { name: 'Ecobank Ghana' }))
  expect(onChange).toHaveBeenCalledWith('ECO')
})
it('shows Telecel while keeping the provider routing code unchanged', () => {
  const onChange = vi.fn()
  render(<BankPicker banks={[{ name: 'Vodafone', code: 'VOD' }]} value="" onChange={onChange} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'telecel' } })
  fireEvent.click(screen.getByRole('option', { name: 'Telecel Cash' }))
  expect(onChange).toHaveBeenCalledWith('VOD')
  expect(screen.queryByText('Vodafone')).not.toBeInTheDocument()
})
