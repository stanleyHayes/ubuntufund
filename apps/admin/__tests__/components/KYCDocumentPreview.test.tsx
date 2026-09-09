import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { KYCDocumentPreview } from '../../src/components/kyc/KYCDocumentPreview'

afterEach(cleanup)

it('renders uploaded images and a link to the original', () => {
  render(<KYCDocumentPreview url="https://example.com/id.jpg" label="id card 1" />)
  const image = screen.getByAltText('id card 1 preview')
  fireEvent.load(image)
  expect(image).toBeVisible()
  expect(screen.getByRole('link', { name: 'Open original id card 1' })).toHaveAttribute('href', 'https://example.com/id.jpg')
})

it('keeps the original accessible when the image preview fails', () => {
  render(<KYCDocumentPreview url="https://example.com/id.jpg" label="id card 1" />)
  fireEvent.error(screen.getByAltText('id card 1 preview'))
  expect(screen.getByRole('status')).toHaveTextContent('Preview could not load')
  expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
})

it('shows a PDF viewer and original link for PDFs with query strings', () => {
  render(<KYCDocumentPreview url="https://example.com/bill.PDF?version=1" label="utility bill 3" />)
  expect(screen.getByTitle('utility bill 3 PDF preview')).toHaveAttribute('src', 'https://example.com/bill.PDF?version=1')
  expect(screen.getByRole('link')).toBeVisible()
})

it('does not render unsafe document URLs', () => {
  render(<KYCDocumentPreview url="javascript:alert(1)" label="id card 1" />)
  expect(screen.getByText(/Document file is unavailable/)).toBeVisible()
  expect(screen.queryByRole('link')).toBeNull()
})
