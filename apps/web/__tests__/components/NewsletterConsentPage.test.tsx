import { beforeEach, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NewsletterConsentPage } from '@/pages/NewsletterConsentPage'
const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/components/auth/AuthLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => children }))
const token = 'c'.repeat(64)
beforeEach(() => { post.mockReset().mockResolvedValue({}); window.history.replaceState({}, '', `/newsletter/confirm#token=${token}`) })
it.each(['confirm', 'unsubscribe'] as const)('requires an explicit %s action and removes the token from the address bar', async action => {
  render(<MemoryRouter><NewsletterConsentPage action={action} /></MemoryRouter>)
  expect(window.location.hash).toBe('')
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(action === 'confirm' ? 'subscription is confirmed' : 'You are unsubscribed')
  expect(post).toHaveBeenCalledExactlyOnceWith(`/newsletter/${action}`, { token })
})
it('keeps support and retry available when a link cannot be used', async () => {
  post.mockRejectedValue(new Error('expired'))
  render(<MemoryRouter><NewsletterConsentPage action="unsubscribe" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This link could not be used')
  expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:support@ujimora.com')
  expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeEnabled()
})
