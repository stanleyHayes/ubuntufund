import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      await screen.findByText('You’re all caught up. New updates will appear here.'),
    ).toBeInTheDocument()
  })
})
