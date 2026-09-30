import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, put: state.put } }))
import { OnBehalfThankYouSettings } from '@/components/OnBehalfThankYouSettings'

const defaults = {
  'onBehalf.publicationRequiresConsent': 1,
  'onBehalf.donationsRequireConsent': 1,
  'onBehalf.staffReviewRequired': 1,
  'onBehalf.invitationTtlHours': 168,
  'onBehalf.minManagerVerificationLevel': 0,
  'thankYou.enabled': 1,
  'thankYou.afterCampaignEnd': 1,
  'thankYou.afterPayoutPaid': 1,
  'thankYou.maxSendsPerCampaign': 1,
}
const resolved = { ...defaults, 'onBehalf.invitationTtlHours': 72, earlyFeePercent: 5 }
const SAVE = 'Save on-behalf and thank-you settings'

beforeEach(() => {
  state.get.mockReset().mockResolvedValue({ resolved, defaults: { ...defaults, earlyFeePercent: 0 } })
  state.put.mockReset().mockResolvedValue([])
})
afterEach(cleanup)

it('shows current values with their defaults and saves only the changed keys with a reason', async () => {
  render(<OnBehalfThankYouSettings canEdit />)
  const donations = await screen.findByRole('switch', { name: 'Take donations only after the beneficiary accepts' })
  expect(state.get).toHaveBeenCalledWith('/admin/commercial-config')
  expect(donations).toBeChecked()
  expect(screen.getByText(/applies only to campaigns created afterwards/)).toBeVisible()
  expect(screen.getByRole('spinbutton', { name: 'Invitation lifetime (hours)' })).toHaveValue(72)
  expect(screen.getByText(/Default: 168 hours\./)).toBeInTheDocument()
  expect(screen.getByText(/Donations stay closed until the beneficiary accepts.*Default: on\./)).toBeInTheDocument()
  const save = screen.getByRole('button', { name: SAVE })
  expect(save).toBeDisabled()

  fireEvent.click(donations)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Thank-you messages per campaign' }), { target: { value: '3' } })
  fireEvent.click(save)
  await waitFor(() => expect(state.put).toHaveBeenCalledTimes(1))
  expect(state.put).toHaveBeenCalledWith('/admin/commercial-config', {
    changes: [
      { key: 'onBehalf.donationsRequireConsent', value: 0 },
      { key: 'thankYou.maxSendsPerCampaign', value: 3 },
    ],
    reason: expect.stringMatching(/\S{3,}/),
  })
  expect(await screen.findByText(/apply to campaigns created from now on/)).toBeVisible()
  expect(screen.getByRole('button', { name: SAVE })).toBeDisabled()
})

it('picks the minimum organizer verification from named levels', async () => {
  render(<OnBehalfThankYouSettings canEdit />)
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Minimum verification of the organizer' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Level 2 · National ID' }))
  fireEvent.click(screen.getByRole('button', { name: SAVE }))
  await waitFor(() => expect(state.put).toHaveBeenCalledWith('/admin/commercial-config', expect.objectContaining({
    changes: [{ key: 'onBehalf.minManagerVerificationLevel', value: 2 }],
  })))
})

it('blocks values outside the allowed ranges and warns when thank-yous can never unlock', async () => {
  render(<OnBehalfThankYouSettings canEdit />)
  const lifetime = await screen.findByRole('spinbutton', { name: 'Invitation lifetime (hours)' })
  fireEvent.change(lifetime, { target: { value: '721' } })
  expect(screen.getByText('Use a whole number from 1 to 720.')).toBeVisible()
  expect(screen.getByRole('button', { name: SAVE })).toBeDisabled()
  fireEvent.change(lifetime, { target: { value: '24' } })
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Thank-you messages per campaign' }), { target: { value: '0' } })
  expect(screen.getByText('Use a whole number from 1 to 10.')).toBeVisible()
  expect(screen.getByRole('button', { name: SAVE })).toBeDisabled()

  fireEvent.click(screen.getByRole('switch', { name: 'Unlock when the campaign ends' }))
  fireEvent.click(screen.getByRole('switch', { name: 'Unlock after a payout is paid' }))
  expect(screen.getByText('With both unlock switches off, no campaign can send a thank-you message.')).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()
})

it('keeps every control read-only without settings permission', async () => {
  render(<OnBehalfThankYouSettings canEdit={false} />)
  const section = await screen.findByRole('region', { name: 'Campaigns on behalf of others and donor thank-you settings' })
  for (const control of within(section).getAllByRole('switch')) expect(control).toBeDisabled()
  expect(within(section).getByRole('spinbutton', { name: 'Invitation lifetime (hours)' })).toBeDisabled()
  expect(within(section).getByRole('button', { name: SAVE })).toBeDisabled()
})

it('offers a retry when the settings cannot load', async () => {
  state.get.mockRejectedValueOnce(new Error('Settings service unavailable'))
  render(<OnBehalfThankYouSettings canEdit />)
  expect(await screen.findByText('Settings service unavailable')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('switch', { name: 'Allow thank-you messages' })).toBeChecked()
})
