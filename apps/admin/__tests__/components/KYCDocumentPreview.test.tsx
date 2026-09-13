import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../src/lib/api'
vi.mock('../../src/lib/api', () => ({ api: { get: vi.fn() } }))
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

it('resolves private references through the authenticated API and allows expiry refresh', async () => {
  vi.mocked(api.get).mockResolvedValue({ url: 'https://api.cloudinary.com/private-download?signature=first', mimeType: 'application/pdf' })
  render(<KYCDocumentPreview url="kyc://aaaaaaaaaaaaaaaaaaaaaaaa" label="Private ID" />)
  expect(await screen.findByTitle('Private ID PDF preview')).toHaveAttribute('src', 'https://api.cloudinary.com/private-download?signature=first')
  expect(api.get).toHaveBeenCalledWith('/uploads/kyc/aaaaaaaaaaaaaaaaaaaaaaaa/access')
  vi.mocked(api.get).mockResolvedValue({ url: 'https://api.cloudinary.com/private-download?signature=renewed', mimeType: 'application/pdf' })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh expiring link' }))
  expect(await screen.findByTitle('Private ID PDF preview')).toHaveAttribute('src', 'https://api.cloudinary.com/private-download?signature=renewed')
})
