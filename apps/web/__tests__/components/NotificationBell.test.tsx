import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationBell } from '@ubuntu-fund/ui'
describe('notification bell', () => {
  it('opens the inbox, marks a notice read and refreshes its badge', async () => {
    let read = false
    const api = {
      get: vi.fn(async (path: string) =>
        path.endsWith('unread-count')
          ? { count: read ? 0 : 1 }
          : [
              {
                id: 'notice',
                title: 'Donation received',
                message: 'Your campaign received GHS 100.',
                createdAt: new Date().toISOString(),
                read,
              },
            ],
      ),
      put: vi.fn(async () => {
        read = true
      }),
    }
    render(<NotificationBell api={api as never} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }))
    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as read' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/notifications/notice/read'))
    fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }))
    expect(
      await screen.findByRole('button', { name: 'Notifications (0 unread)' }),
    ).toBeInTheDocument()
  })
  it('shows retry when the inbox request fails', async () => {
    const api = { get: vi.fn().mockRejectedValue(new Error('offline')), put: vi.fn() }
    render(<NotificationBell api={api} />)
    fireEvent.click(screen.getByRole('button', { name: 'Notifications (0 unread)' }))
    expect(
      await screen.findByText('Notifications could not be loaded. Please retry.'),
    ).toBeInTheDocument()
    api.get.mockImplementation(async (path: string) =>
      path.endsWith('unread-count') ? { count: 0 } : [],
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText('You’re all caught up'),
    ).toBeInTheDocument()
  })
})

it.each([null, [], { count: -1 }, { count: 1.5 }, { count: NaN }, { count: '2' }])('rejects malformed unread counts and recovers on retry: %j', async count => {
  let repaired = false
  const api = { get: vi.fn(async (path: string) => path.endsWith('unread-count') ? repaired ? { count: 0 } : count : []), put: vi.fn() }
  render(<NotificationBell api={api as never} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications (unavailable)' }))
  await screen.findByText('Notifications could not be loaded. Please retry.')
  expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument()
  repaired = true
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('You’re all caught up')
  fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }))
  expect(await screen.findByRole('button', { name: 'Notifications (0 unread)' })).toBeInTheDocument()
})
it('rejects invalid inbox records without crashing or reporting an empty inbox', async () => {
  const api = { get: vi.fn(async (path: string) => path.endsWith('unread-count') ? { count: 1 } : [null]), put: vi.fn() }
  render(<NotificationBell api={api as never} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications (unavailable)' }))
  await screen.findByText('Notifications could not be loaded. Please retry.')
  expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument()
})
it('ignores an older inbox refresh after a newer response has completed', async () => {
  let resolveNotices!: (value: unknown) => void, resolveCount!: (value: unknown) => void
  const notices = new Promise(resolve => { resolveNotices = resolve }), count = new Promise(resolve => { resolveCount = resolve })
  let calls = 0
  const api = { get: vi.fn(async (path: string) => ++calls <= 2 ? path.endsWith('unread-count') ? count : notices : path.endsWith('unread-count') ? { count: 0 } : []), put: vi.fn() }
  render(<NotificationBell api={api as never} />)
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Notifications (0 unread)' }))
  await screen.findByText('You’re all caught up')
  await act(async () => {
    resolveNotices([{ id: 'old', title: 'Outdated notice', message: 'Earlier response', read: false, createdAt: new Date().toISOString() }]); resolveCount({ count: 1 })
    await Promise.all([notices, count])
  })
  expect(screen.queryByText('Outdated notice')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }))
  expect(await screen.findByRole('button', { name: 'Notifications (0 unread)' })).toBeInTheDocument()
})
