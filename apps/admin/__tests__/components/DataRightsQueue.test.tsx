// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DataRightsQueue } from '@/components/DataRightsQueue'
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, put } }))
const item = { _id: 'abc', userId: 'owner', kind: 'access', status: 'open', details: 'Please provide my data.', response: '', revision: 0, dueAt: '2026-10-12T00:00:00Z' }
beforeEach(() => { get.mockReset().mockResolvedValue({ items: [item], total: 1 }); put.mockReset().mockResolvedValue({}) })
it('requires review evidence and a response before publishing', async () => {
  render(<DataRightsQueue />)
  const publish = await screen.findByRole('button', { name: 'Publish response to requester' })
  expect(publish).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Internal review evidence'), { target: { value: 'Reviewed the account and processor inventory.' } })
  expect(publish).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Response visible to requester'), { target: { value: 'Here is the requested account information.' } })
  get.mockResolvedValue({ items: [], total: 0 })
  fireEvent.click(publish)
  expect(await screen.findByText('No requests in this view.')).toBeInTheDocument()
  expect(put).toHaveBeenCalledExactlyOnceWith('/admin/data-rights/abc/review', { revision: 0, status: 'responded', evidence: 'Reviewed the account and processor inventory.', response: 'Here is the requested account information.', deliveryMethod: 'account', deliveryReference: '' })
})
it('preserves review text when a stale revision is rejected', async () => {
  put.mockRejectedValue(new Error('Request changed. Refresh before reviewing.'))
  render(<DataRightsQueue />)
  await screen.findByText('Please provide my data.')
  fireEvent.change(screen.getByLabelText('Internal review evidence'), { target: { value: 'Reviewed the account and processor inventory.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save review progress' }))
  expect(await screen.findByText('Request changed. Refresh before reviewing.')).toBeInTheDocument()
  expect(screen.getByLabelText('Internal review evidence')).toHaveValue('Reviewed the account and processor inventory.')
})
