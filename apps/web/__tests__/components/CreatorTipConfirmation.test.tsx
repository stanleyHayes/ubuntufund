import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
const { post, finish } = vi.hoisted(() => ({ post: vi.fn(), finish: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/lib/tipCheckout', () => ({ finishTipAttempt: finish }))
vi.mock('@/components/donate/DonationCelebration', () => ({ DonationCelebration: () => null }))
import { CreatorTipCallbackPage } from '@/pages/CreatorTipCallbackPage'
function Navigation() { const navigate = useNavigate(); return <button onClick={() => navigate('/tip/callback?reference=tip-second')}>Other payment</button> }
function show() { render(<MemoryRouter initialEntries={['/tip/callback?reference=tip-first']}><Navigation /><CreatorTipCallbackPage /></MemoryRouter>) }
beforeEach(() => { post.mockReset(); finish.mockReset() })
it('clears a previous successful result when the payment reference changes', async () => {
  post.mockResolvedValueOnce({ status: 'SUCCEEDED', amount: 25, currency: 'GHS', displayName: 'First Creator' }).mockReturnValue(new Promise(() => {}))
  show()
  await screen.findByRole('heading', { name: 'Thank you for your support!' })
  fireEvent.click(screen.getByRole('button', { name: 'Other payment' }))
  expect(screen.queryByRole('heading', { name: 'Thank you for your support!' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Confirming your support…' })).toBeTruthy()
  expect(screen.queryByText(/First Creator/)).toBeNull()
  await waitFor(() => expect(post).toHaveBeenLastCalledWith('/creators/tips/verify', { reference: 'tip-second' }))
})
it('shows confirmed success even if browser storage cleanup fails', async () => {
  finish.mockImplementation(() => { throw new Error('storage unavailable') })
  post.mockResolvedValue({ status: 'SUCCEEDED', amount: 25, currency: 'GHS' })
  show()
  await screen.findByRole('heading', { name: 'Thank you for your support!' })
  expect(screen.queryByText('storage unavailable')).toBeNull()
  expect(finish).toHaveBeenCalledWith('tip-first')
})
it.each([
  ['pending', 'Your payment is confirmed. Your public name and message are waiting for staff review.'],
  ['approved', 'Your public name and message passed review. Your anonymity choice still applies.'],
  ['rejected', /Your payment is confirmed. Your public name and message were not approved/],
])('shows %s content review separately from successful payment', async (contentReviewStatus, message) => {
  post.mockResolvedValue({ status: 'SUCCEEDED', contentReviewStatus, amount: 25, currency: 'GHS' })
  show()
  await screen.findByRole('heading', { name: 'Thank you for your support!' })
  expect(screen.getByText(message)).toBeTruthy()
})
