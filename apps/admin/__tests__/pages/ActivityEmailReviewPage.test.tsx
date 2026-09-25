import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), edit: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, patch: state.patch } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.edit }) }))
import ActivityEmailReviewPage from '@/pages/ActivityEmailReviewPage'

const item = { id: 'd1', userId: 'u1', category: 'donationsReceived', title: 'Your campaign received a donation', idempotencyKey: 'activity/d1', firstAttemptAt: '2026-09-23T10:00:00Z', attempts: 2, lastError: 'email_delivery_requires_review', occurredAt: '2026-09-23T09:00:00Z' }
const NOTE = 'Provider log shows this key delivered at 10:02.'
const renderPage = () => render(<MemoryRouter><ActivityEmailReviewPage /></MemoryRouter>)
beforeEach(() => { state.get.mockReset().mockResolvedValue({ items: [item], total: 1 }); state.patch.mockReset().mockResolvedValue({ resolved: true }); state.edit = true })
afterEach(cleanup)

it('shows the idempotency key and records an outcome only with a note', async () => {
  state.get.mockResolvedValueOnce({ items: [item], total: 1 }).mockResolvedValue({ items: [], total: 0 })
  renderPage()
  expect(await screen.findByText('activity/d1')).toBeVisible()
  expect(screen.queryByRole('button', { name: /re-?send/i })).toBeNull()
  const delivered = screen.getByRole('button', { name: 'Mark delivered' })
  expect(delivered).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /provider log shows/i }), { target: { value: NOTE } })
  fireEvent.click(delivered)
  await waitFor(() => expect(state.patch).toHaveBeenCalledWith('/admin/activity-deliveries/d1', { action: 'delivered', note: NOTE }))
  expect(await screen.findByText('No activity emails need a check.')).toBeVisible()
})

it('keeps outcomes disabled for read-only staff', async () => {
  state.edit = false
  renderPage()
  expect(await screen.findByRole('button', { name: 'Give up on this email' })).toBeDisabled()
})
