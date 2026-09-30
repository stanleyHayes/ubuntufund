import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PrivateDocumentUpload } from '@/components/auth/PrivateDocumentUpload'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

const upload = { value: '', onChange: vi.fn(), uploadFn: vi.fn(), accept: 'image/*,application/pdf' }

it('shows help inline right after the label, and the label only once', () => {
  render(<PrivateDocumentUpload {...upload} label="Organization registration document" help={<button type="button">Explain</button>} />)
  const [label, ...repeats] = screen.getAllByText('Organization registration document')
  expect(repeats).toHaveLength(0)
  expect(label.nextElementSibling).toBe(screen.getByRole('button', { name: 'Explain' }))
  expect(screen.getByRole('button', { name: /Click to upload/ })).toBeInTheDocument()
})

it('leaves an upload without help as it was', () => {
  render(<PrivateDocumentUpload {...upload} label="Front side" />)
  expect(screen.getAllByText('Front side')).toHaveLength(1)
  expect(screen.getAllByRole('button')).toHaveLength(1)
})
