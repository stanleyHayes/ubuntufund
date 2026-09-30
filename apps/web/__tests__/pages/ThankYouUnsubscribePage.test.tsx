import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/components/auth/AuthLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => children }))

import { ThankYouUnsubscribePage } from '@/pages/ThankYouUnsubscribePage'

const token = `${'d'.repeat(64)}.c2lnbmF0dXJlLXZhbHVlLWJhc2U2NHVybA`
const renderPage = () => render(<MemoryRouter><ThankYouUnsubscribePage /></MemoryRouter>)

beforeEach(() => {
  post.mockReset().mockResolvedValue(null)
  window.history.replaceState({}, '', `/unsubscribe/thank-you#token=${token}`)
})

it('stops thank-you messages only after the explicit button, and clears the token from the address bar', async () => {
  renderPage()
  expect(window.location.hash).toBe('')
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Stop thank-you messages' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Campaigns will not send thank-you messages to this email address.')
  expect(post).toHaveBeenCalledExactlyOnceWith('/donor-messages/unsubscribe', { token })
  expect(screen.queryByRole('button', { name: 'Stop thank-you messages' })).not.toBeInTheDocument()
})

it('says when the link is not valid', async () => {
  post.mockRejectedValue(Object.assign(new Error('This unsubscribe link is not valid.'), { status: 400 }))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Stop thank-you messages' }))
  expect(await screen.findByText(/This link is not valid\. Open the complete link from your email/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Stop thank-you messages' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Settings' })).toHaveAttribute('href', '/settings')
})

it('keeps the button for a retry after a temporary failure', async () => {
  post.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Stop thank-you messages' }))
  expect(await screen.findByText('We could not save your choice. Please try again.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stop thank-you messages' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Campaigns will not send thank-you messages')
  expect(post).toHaveBeenCalledTimes(2)
})

it('asks for the complete link when it has no token', () => {
  window.history.replaceState({}, '', '/unsubscribe/thank-you')
  renderPage()
  expect(screen.getByText(/This link is not valid/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Stop thank-you messages' })).not.toBeInTheDocument()
})
