import { beforeEach, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/components/auth/AuthLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => children }))
const token = 'a'.repeat(64)
beforeEach(() => { post.mockReset().mockResolvedValue({}); window.history.replaceState({}, '', `/reset-password#token=${token}`) })
function show() { render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>) }
it('removes the fragment from history and submits the token only with matching new passwords', async () => {
  show()
  expect(window.location.hash).toBe('')
  fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: 'SecurePass123' } })
  fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'DifferentPass123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('do not match')
  expect(post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'SecurePass123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(post).toHaveBeenCalledWith('/auth/reset-password', { token, newPassword: 'SecurePass123' })
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
})
it('offers a new link for a missing token without submitting a reset', () => {
  window.history.replaceState({}, '', '/reset-password')
  show()
  expect(screen.getByRole('alert')).toHaveTextContent('Open the complete link')
  expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  expect(post).not.toHaveBeenCalled()
})
it('keeps provider/API failure visible and allows another attempt', async () => {
  post.mockRejectedValueOnce(new Error('expired'))
  show()
  for (const label of ['New password', 'Confirm new password']) fireEvent.change(screen.getByLabelText(new RegExp('^' + label)), { target: { value: 'SecurePass123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('may have expired or been used')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Change password' })).toBeEnabled())
})
