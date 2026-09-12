import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WebsiteRequestNotice } from '@/components/auth/WebsiteRequestNotice'
const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { role: 'organization', needsWebsite: true } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))

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
})
