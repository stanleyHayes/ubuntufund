import { beforeEach, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/components/auth/AuthLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => children }))
const token = 'b'.repeat(64)
beforeEach(() => { post.mockReset().mockResolvedValue({}); window.history.replaceState({}, '', `/verify-email#token=${token}`) })
it('requires explicit confirmation and does not subscribe the user', async () => {
  render(<MemoryRouter><VerifyEmailPage /></MemoryRouter>)
  expect(window.location.hash).toBe('')
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Verify email address' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('choices have not changed')
  expect(post).toHaveBeenCalledExactlyOnceWith('/email-verification/confirm', { token })
})
it('shows a failed confirmation and allows requesting another link from Settings', async () => {
  post.mockRejectedValue(new Error('expired'))
  render(<MemoryRouter><VerifyEmailPage /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Verify email address' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('may have expired or been used')
  expect(screen.getByRole('link', { name: 'Go to Settings' })).toHaveAttribute('href', '/settings')
})
