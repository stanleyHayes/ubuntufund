import { beforeEach, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { defaultActivityAlertPreferences, ACTIVITY_ALERT_LABELS } from '@ubuntu-fund/types'
import { ActivityAlertSettings } from '@/components/account/ActivityAlertSettings'

const { get, put, post } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, put, post } }))
beforeEach(() => {
  get.mockReset().mockResolvedValue({ preferences: defaultActivityAlertPreferences(), emailVerified: true, emailConfigured: true })
  put.mockReset().mockResolvedValue({})
  post.mockReset().mockResolvedValue({ emailVerified: false })
})
const label = `${ACTIVITY_ALERT_LABELS.withdrawals} in-app alerts`

it('starts every activity off and saves only the chosen channel with visible confirmation', async () => {
  render(<ActivityAlertSettings />)
  const toggle = await screen.findByRole('checkbox', { name: label })
  expect(screen.getAllByRole('checkbox')).toHaveLength(14)
  for (const input of screen.getAllByRole('checkbox')) expect(input).not.toBeChecked()
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle).toBeChecked())
  expect(put).toHaveBeenCalledWith('/profile/activity-alerts', { category: 'withdrawals', channel: 'inApp', enabled: true })
  expect(screen.getByRole('status')).toHaveTextContent('enabled')
  expect(screen.getByRole('checkbox', { name: `${ACTIVITY_ALERT_LABELS.withdrawals} emails` })).not.toBeChecked()
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle).not.toBeChecked())
  expect(screen.getByRole('status')).toHaveTextContent('turned off')
})

it('does not display a failed preference save as successful and permits retry', async () => {
  put.mockRejectedValueOnce(new Error('Connection lost'))
  render(<ActivityAlertSettings />)
  const toggle = await screen.findByRole('checkbox', { name: label })
  fireEvent.click(toggle)
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
  expect(toggle).not.toBeChecked()
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle).toBeChecked())
})

it('allows an unverified user to disable an existing email choice but not enable another', async () => {
  const preferences = defaultActivityAlertPreferences()
  preferences.withdrawals.email = true
  get.mockResolvedValue({ preferences, emailVerified: false, emailConfigured: true })
  render(<ActivityAlertSettings />)
  const enabled = await screen.findByRole('checkbox', { name: `${ACTIVITY_ALERT_LABELS.withdrawals} emails` })
  expect(enabled).toBeEnabled()
  expect(screen.getByRole('checkbox', { name: `${ACTIVITY_ALERT_LABELS.wallet} emails` })).toBeDisabled()
  fireEvent.click(enabled)
  await waitFor(() => expect(enabled).not.toBeChecked())
  expect(enabled).toBeDisabled()
})

it('recovers from a failed initial load without inventing saved preferences', async () => {
  get.mockRejectedValueOnce(new Error('offline'))
  render(<ActivityAlertSettings />)
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('checkbox', { name: label })).not.toBeChecked()
  expect(get).toHaveBeenCalledTimes(2)
})

it('requests verification separately and refreshes eligibility without enabling email choices', async () => {
  get.mockResolvedValueOnce({ preferences: defaultActivityAlertPreferences(), emailVerified: false, emailConfigured: true })
  render(<ActivityAlertSettings />)
  fireEvent.click(await screen.findByRole('button', { name: 'Send verification link' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Check your email')
  expect(post).toHaveBeenCalledWith('/email-verification', {})
  const email = screen.getByRole('checkbox', { name: `${ACTIVITY_ALERT_LABELS.withdrawals} emails` })
  expect(email).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Check verification status' }))
  await waitFor(() => expect(email).toBeEnabled())
  expect(email).not.toBeChecked()
  expect(put).not.toHaveBeenCalled()
})
