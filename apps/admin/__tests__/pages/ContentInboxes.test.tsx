vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, put: state.put, post: state.post, patch: state.patch, delete: state.del } }))
import ContactSubmissionsPage from '@/pages/ContactSubmissionsPage'
import TestimonialsPage from '@/pages/TestimonialsPage'

const submission = { id: 'c1', name: 'Kofi', email: 'kofi@example.test', subject: 'Partnership idea', message: 'Hello', inquiryType: 'partnership', status: 'new', createdAt: '2026-09-20T10:00:00Z' }
const testimonial = { id: 't1', name: 'Esi', role: 'Organizer', location: 'Accra', quote: 'Great platform', rating: 5, avatarColor: '#123456', status: 'published', displayOrder: 1, createdAt: '2026-09-20T10:00:00Z' }
beforeEach(() => { for (const fn of Object.values(state)) fn.mockReset() })
afterEach(cleanup)

it('shows a contact-inbox load failure with retry instead of an empty inbox', async () => {
  state.get.mockRejectedValueOnce(new Error('Your account does not have permission to perform this action.')).mockImplementation(async (path: string) =>
    path.startsWith('/contact/stats') ? { total: 1, new: 1, inProgress: 0, resolved: 0 } : { items: [submission], total: 1 })
  render(<ContactSubmissionsPage />)
  expect(await screen.findByText(/does not have permission/)).toBeVisible()
  expect(screen.queryByText('No submissions found')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Partnership idea')).toBeVisible()
  expect(state.get).toHaveBeenCalledWith(expect.stringMatching(/^\/contact\?page=1&pageSize=20/))
  expect(state.get).toHaveBeenCalledWith('/contact/stats')
})

it('shows a testimonials load failure with retry instead of an empty list', async () => {
  state.get.mockRejectedValueOnce(new Error('The server could not complete this request. Please try again.')).mockImplementation(async (path: string) =>
    path.startsWith('/testimonials/stats') ? { total: 1, published: 1, draft: 0, archived: 0 } : { items: [testimonial], total: 1 })
  render(<TestimonialsPage />)
  expect(await screen.findByText(/server could not complete/)).toBeVisible()
  expect(screen.queryByText('No testimonials found')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText(/Great platform/)).toBeVisible()
})

it('reports a failed testimonial delete rather than silently ignoring it', async () => {
  state.get.mockImplementation(async (path: string) =>
    path.startsWith('/testimonials/stats') ? { total: 1, published: 1, draft: 0, archived: 0 } : { items: [testimonial], total: 1 })
  state.del.mockRejectedValue(new Error('Delete refused by the server.'))
  render(<TestimonialsPage />)
  await screen.findByText(/Great platform/)
  fireEvent.click(screen.getByRole('button', { name: 'Remove testimonial from Esi' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(state.del).toHaveBeenCalledWith('/testimonials/t1'))
  expect(await screen.findByText('Delete refused by the server.')).toBeVisible()
})
