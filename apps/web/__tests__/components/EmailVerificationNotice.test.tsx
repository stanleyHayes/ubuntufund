import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmailVerificationNotice } from '@/components/account/EmailVerificationNotice'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post } }))
beforeEach(() => { get.mockReset(); post.mockReset() })

it('asks an unverified member to verify and sends the link on request', async () => {
  get.mockResolvedValue({ emailVerified: false, deliveryConfigured: true })
  post.mockResolvedValue({ emailVerified: false })
  render(<EmailVerificationNotice />)
  expect(await screen.findByText(/Verify your email address\. Automatic payouts and organization invitations/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Send link' }))
  expect(await screen.findByText(/Check your email for a verification link/)).toBeInTheDocument()
  expect(post).toHaveBeenCalledWith('/email-verification', {})
})

it.each([
  [{ emailVerified: true, deliveryConfigured: true }],
  [{ emailVerified: false, deliveryConfigured: false }],
])('stays hidden when there is nothing the member can do (%j)', async (status) => {
  get.mockResolvedValue(status)
  const { container } = render(<EmailVerificationNotice />)
  await waitFor(() => expect(get).toHaveBeenCalledWith('/email-verification'))
  expect(container).toBeEmptyDOMElement()
})

it('shows why sending failed', async () => {
  get.mockResolvedValue({ emailVerified: false, deliveryConfigured: true })
  post.mockRejectedValue(new Error('Too many attempts. Please wait a moment and try again.'))
  render(<EmailVerificationNotice />)
  fireEvent.click(await screen.findByRole('button', { name: 'Send link' }))
  expect(await screen.findByText('Too many attempts. Please wait a moment and try again.')).toBeInTheDocument()
})
