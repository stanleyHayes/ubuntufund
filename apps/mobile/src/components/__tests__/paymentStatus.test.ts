import { createElement } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { PaymentStatus } from '../PaymentStatus'
import { api } from '@/lib/api'
vi.mock('react-native', () => ({ View: 'div', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } }))
vi.mock('react-native-paper', () => ({ Text: 'span' }))
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }))
vi.mock('../DonationCelebration', () => ({ DonationCelebration: () => null }))
vi.mock('../Loading', () => ({ Skeleton: () => null, Button: ({ children, onPress, disabled }: { children: string; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({ raised: {} }) }))
vi.mock('@/lib/payments', () => ({ isPaymentSuccess: (status: string) => status === 'SUCCEEDED', isPaymentTerminal: (status: string) => ['SUCCEEDED', 'FAILED', 'EXPIRED'].includes(status) }))
beforeEach(() => vi.clearAllMocks())
const payment = (id: string, status = 'SUCCEEDED') => ({ id, status, storageKey: '' })
it('reads review status for an already settled wallet donation and retains success on refresh failure', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ status: 'SUCCEEDED', contentReviewStatus: 'pending' })
  const completed = vi.fn()
  render(createElement(PaymentStatus, { payment: payment('first'), onComplete: completed, onReset() {} }))
  expect(await screen.findByText(/awaiting review/)).toBeTruthy()
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByText('Refresh content review'))
  expect(await screen.findByText('offline')).toBeTruthy()
  expect(screen.queryByText(/awaiting review/)).toBeNull()
  expect(screen.getByText('Thank you for your support')).toBeTruthy()
  vi.mocked(api.get).mockResolvedValueOnce({ status: 'SUCCEEDED', contentReviewStatus: 'approved' })
  fireEvent.click(screen.getByText('Refresh content review'))
  expect(await screen.findByText(/has been approved/)).toBeTruthy()
  expect(completed).toHaveBeenCalledTimes(1)
  expect(api.post).not.toHaveBeenCalled()
})
it('discards a previous payment response after switching targets without caller keys', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(createElement(PaymentStatus, { payment: payment('first', 'PENDING'), onReset() {} }))
  vi.mocked(api.get).mockResolvedValue({ status: 'SUCCEEDED', contentReviewStatus: 'rejected' })
  view.rerender(createElement(PaymentStatus, { payment: payment('second'), onReset() {} }))
  expect(await screen.findByText(/was not approved/)).toBeTruthy()
  await act(async () => finish({ status: 'SUCCEEDED', contentReviewStatus: 'approved' }))
  expect(screen.queryByText(/has been approved/)).toBeNull()
  expect(screen.getByText('Reference: second')).toBeTruthy()
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/donation-intents/second/public'))
})
