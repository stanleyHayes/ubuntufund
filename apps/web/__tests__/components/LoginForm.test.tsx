import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ApiError } from '@/lib/api'

const { login, post } = vi.hoisted(() => ({ login: vi.fn(), post: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ login }) }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/api')>(), api: { post } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/components/auth/AuthLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => children }))

beforeEach(() => { login.mockReset(); post.mockReset().mockResolvedValue({}) })

function show() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('links to password recovery from sign-in and carries the typed email over', async () => {
  show()
  const link = screen.getByRole('link', { name: 'Forgot password?' })
  expect(link).toHaveAttribute('href', '/forgot-password')
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: ' ama@example.com ' } })
  fireEvent.click(screen.getByRole('link', { name: 'Forgot password?' }))
  expect(await screen.findByLabelText(/^Email address/)).toHaveValue('ama@example.com')
  expect(login).not.toHaveBeenCalled()
})

it.each([
  [new ApiError(429, 'Too many requests'), 'Too many attempts'],
  [new ApiError(400, 'Validation failed'), 'Enter a valid email address'],
  [new ApiError(0, 'offline'), 'reach Ujimora'],
  [new TypeError('Failed to fetch'), 'reach Ujimora'],
  [new ApiError(503, 'down'), 'temporarily unavailable'],
])('explains why a reset request failed (%s)', async (failure, message) => {
  post.mockRejectedValueOnce(failure)
  show()
  fireEvent.click(screen.getByRole('link', { name: 'Forgot password?' }))
  fireEvent.change(await screen.findByLabelText(/^Email address/), { target: { value: 'ama@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled())
})
