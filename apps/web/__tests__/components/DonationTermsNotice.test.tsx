import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DonationTermsNotice } from '@/components/donate/DonationTermsNotice'

// I086 (mitigation): guest donors without a message saw no terms or age notice.
it('names the governing terms and the minimum age next to the pay button', () => {
  render(<MemoryRouter><DonationTermsNotice /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Contributor Terms' })).toHaveAttribute('href', '/contributor-terms')
  expect(screen.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('href', '/privacy')
  expect(screen.getByText(/18 or older/)).toBeInTheDocument()
})
