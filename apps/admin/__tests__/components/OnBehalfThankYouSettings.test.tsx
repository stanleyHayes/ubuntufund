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
const SAVE_ON_BEHALF = 'Save on-behalf settings'
const SAVE_THANK_YOU = 'Save thank-you settings'
const onBehalfPanel = () => screen.findByRole('region', { name: 'Campaigns on behalf of others' })
const thankYouPanel = () => screen.findByRole('region', { name: 'Donor thank-you messages' })

beforeEach(() => {
  state.get.mockReset().mockResolvedValue({ resolved, defaults: { ...defaults, earlyFeePercent: 0 } })
  state.put.mockReset().mockResolvedValue([])
})
afterEach(cleanup)

it('shows current values with their defaults and each panel saves only its own changed keys with a reason', async () => {
  render(<OnBehalfThankYouSettings canEdit />)
  const onBehalf = await onBehalfPanel()
  const thankYou = await thankYouPanel()
  expect(state.get).toHaveBeenCalledTimes(1)
  expect(state.get).toHaveBeenCalledWith('/admin/commercial-config')
  const donations = within(onBehalf).getByRole('switch', { name: 'Take donations only after the beneficiary accepts' })
  expect(donations).toBeChecked()
  expect(within(onBehalf).getByText(/applies only to campaigns created afterwards/)).toBeVisible()
  expect(within(onBehalf).getByRole('spinbutton', { name: 'Invitation lifetime (hours)' })).toHaveValue(72)
  expect(within(onBehalf).getByText(/Default: 168 hours\./)).toBeInTheDocument()
  expect(within(onBehalf).getByText(/Donations stay closed until the beneficiary accepts.*Default: on\./)).toBeInTheDocument()
  expect(within(thankYou).getByRole('switch', { name: 'Allow thank-you messages' })).toBeChecked()
  const saveOnBehalf = within(onBehalf).getByRole('button', { name: SAVE_ON_BEHALF })
  const saveThankYou = within(thankYou).getByRole('button', { name: SAVE_THANK_YOU })
  expect(saveOnBehalf).toBeDisabled()
  expect(saveThankYou).toBeDisabled()

  fireEvent.click(donations)
  fireEvent.change(within(thankYou).getByRole('spinbutton', { name: 'Thank-you messages per campaign' }), { target: { value: '3' } })
  expect(saveOnBehalf).toBeEnabled()
  expect(saveThankYou).toBeEnabled()

  fireEvent.click(saveOnBehalf)
  await waitFor(() => expect(state.put).toHaveBeenCalledTimes(1))
  expect(state.put).toHaveBeenLastCalledWith('/admin/commercial-config', {
    changes: [{ key: 'onBehalf.donationsRequireConsent', value: 0 }],
    reason: expect.stringMatching(/\S{3,}/),
  })
  expect(await within(onBehalf).findByText(/apply to campaigns created from now on/)).toBeVisible()
  expect(within(onBehalf).getByRole('button', { name: SAVE_ON_BEHALF })).toBeDisabled()
  // The other panel keeps its unsaved change and its own Save.
  expect(within(thankYou).queryByRole('alert')).toBeNull()
  expect(within(thankYou).getByRole('spinbutton', { name: 'Thank-you messages per campaign' })).toHaveValue(3)

  fireEvent.click(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU }))
  await waitFor(() => expect(state.put).toHaveBeenCalledTimes(2))
  expect(state.put).toHaveBeenLastCalledWith('/admin/commercial-config', {
    changes: [{ key: 'thankYou.maxSendsPerCampaign', value: 3 }],
    reason: state.put.mock.calls[0][1].reason,
  })
  expect(await within(thankYou).findByText('Saved. The new values apply from now on.')).toBeVisible()
  expect(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU })).toBeDisabled()
})

it('picks the minimum organizer verification from named levels', async () => {
  render(<OnBehalfThankYouSettings canEdit />)
  const onBehalf = await onBehalfPanel()
  fireEvent.mouseDown(within(onBehalf).getByRole('combobox', { name: 'Minimum verification of the organizer' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Level 2 · National ID' }))
  fireEvent.click(within(onBehalf).getByRole('button', { name: SAVE_ON_BEHALF }))
  await waitFor(() => expect(state.put).toHaveBeenCalledWith('/admin/commercial-config', expect.objectContaining({
    changes: [{ key: 'onBehalf.minManagerVerificationLevel', value: 2 }],
  })))
  expect(await within(onBehalf).findByText('Saved. The new values apply from now on.')).toBeVisible()
})

it('blocks values outside the allowed ranges per panel and warns when thank-yous can never unlock', async () => {
  render(<OnBehalfThankYouSettings canEdit />)
  const onBehalf = await onBehalfPanel()
  const thankYou = await thankYouPanel()
  const lifetime = within(onBehalf).getByRole('spinbutton', { name: 'Invitation lifetime (hours)' })
  fireEvent.change(lifetime, { target: { value: '721' } })
  expect(within(onBehalf).getByText('Use a whole number from 1 to 720.')).toBeVisible()
  expect(within(onBehalf).getByRole('button', { name: SAVE_ON_BEHALF })).toBeDisabled()

  // An invalid on-behalf value does not hold back the thank-you panel.
  const count = within(thankYou).getByRole('spinbutton', { name: 'Thank-you messages per campaign' })
  fireEvent.change(count, { target: { value: '2' } })
  expect(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU })).toBeEnabled()
  fireEvent.change(count, { target: { value: '0' } })
  expect(within(thankYou).getByText('Use a whole number from 1 to 10.')).toBeVisible()
  expect(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU })).toBeDisabled()

  fireEvent.click(within(thankYou).getByRole('switch', { name: 'Unlock when the campaign ends' }))
  fireEvent.click(within(thankYou).getByRole('switch', { name: 'Unlock after a payout is paid' }))
  expect(within(thankYou).getByText('With both unlock switches off, no campaign can send a thank-you message.')).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()
})

it('shows a failed save in its own panel only', async () => {
  state.put.mockRejectedValueOnce(new Error('Config store unavailable'))
  render(<OnBehalfThankYouSettings canEdit />)
  const onBehalf = await onBehalfPanel()
  const thankYou = await thankYouPanel()
  fireEvent.click(within(thankYou).getByRole('switch', { name: 'Allow thank-you messages' }))
  fireEvent.click(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU }))
  expect(await within(thankYou).findByText('Config store unavailable')).toBeVisible()
  expect(within(onBehalf).queryByText('Config store unavailable')).toBeNull()
  expect(state.put).toHaveBeenCalledWith('/admin/commercial-config', expect.objectContaining({
    changes: [{ key: 'thankYou.enabled', value: 0 }],
  }))
  // Still unsaved, so it can be sent again.
  expect(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU })).toBeEnabled()
})

it('keeps every control read-only without settings permission', async () => {
  render(<OnBehalfThankYouSettings canEdit={false} />)
  const onBehalf = await onBehalfPanel()
  const thankYou = await thankYouPanel()
  for (const section of [onBehalf, thankYou]) {
    for (const control of within(section).getAllByRole('switch')) expect(control).toBeDisabled()
    for (const control of within(section).getAllByRole('spinbutton')) expect(control).toBeDisabled()
  }
  expect(within(onBehalf).getByRole('button', { name: SAVE_ON_BEHALF })).toBeDisabled()
  expect(within(thankYou).getByRole('button', { name: SAVE_THANK_YOU })).toBeDisabled()
})

it('offers a retry when the settings cannot load', async () => {
  state.get.mockRejectedValueOnce(new Error('Settings service unavailable'))
  render(<OnBehalfThankYouSettings canEdit />)
  expect(await screen.findByText('Settings service unavailable')).toBeVisible()
  expect(screen.queryByRole('region')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('switch', { name: 'Allow thank-you messages' })).toBeChecked()
  expect(screen.getAllByRole('region')).toHaveLength(2)
})
