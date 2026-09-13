import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WebsiteRequestNotice } from '@/components/auth/WebsiteRequestNotice'
const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { role: 'organization', needsWebsite: true } }))
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get, post } }))
beforeEach(() => {
  Object.assign(auth, { isAuthenticated: true, user: { role: 'organization', needsWebsite: true } })
  get.mockReset().mockImplementation(async () => ({ needsWebsite: auth.user.needsWebsite }))
  post.mockReset().mockResolvedValue({ needsWebsite: false })
})

describe('Website request notice', () => {
  it('shows the saved request and contact links after sign-in', () => {
    render(<WebsiteRequestNotice />)
    expect(screen.getByRole('alert')).toHaveTextContent('Neurodyne Corp Ltd, will contact you')
    expect(screen.getByRole('link', { name: 'neurodyne.dev' })).toHaveAttribute('href', 'https://neurodyne.dev')
    expect(screen.getByRole('link', { name: 'info@neurodyne.dev' })).toHaveAttribute('href', 'mailto:info@neurodyne.dev')
  })
  it.each([
    { isAuthenticated: false, role: 'organization', needsWebsite: true },
    { isAuthenticated: true, role: 'organization', needsWebsite: false },
    { isAuthenticated: true, role: 'user', needsWebsite: true },
  ])('hides the notice for %j', ({ isAuthenticated, role, needsWebsite }) => {
    Object.assign(auth, { isAuthenticated, user: { role, needsWebsite } })
    render(<WebsiteRequestNotice />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('withdraws only after a successful save and keeps contact details available', async () => {
    render(<WebsiteRequestNotice />)
    await waitFor(() => expect(get).toHaveBeenCalled())
    post.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw website request' }))
    expect(await screen.findByText('Could not withdraw your request. Please try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw website request' }))
    expect(await screen.findByText(/Your website-contact request has been withdrawn/)).toBeInTheDocument()
    expect(post).toHaveBeenLastCalledWith('/profile/website-request/withdraw')
    expect(screen.queryByRole('button', { name: 'Withdraw website request' })).not.toBeInTheDocument()
  })
  it('refreshes a stale saved sign-in flag from the server', async () => {
    get.mockResolvedValue({ needsWebsite: false })
    render(<WebsiteRequestNotice />)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
