import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, put: state.put } }))
import { CampaignReviewSettings } from '@/components/CampaignReviewSettings'

const resolved = { 'campaigns.autoApproveMaxTier': 2, 'campaigns.tierThreshold1': 1000, 'campaigns.tierThreshold2': 5000, 'campaigns.tierThreshold3': 20000, 'campaigns.tierThreshold4': 100000, 'alerts.reviewEmail': 'review@example.test' }
beforeEach(() => { state.get.mockReset().mockResolvedValue({ resolved }); state.put.mockReset().mockResolvedValue([]) })
afterEach(cleanup)

it('saves the tier, all four thresholds and the alert address in one request', async () => {
  render(<CampaignReviewSettings canEdit />)
  fireEvent.change(await screen.findByLabelText('Tier 2 ceiling (GH₵)'), { target: { value: '6000' } })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(state.put).toHaveBeenCalledTimes(1))
  expect(state.put).toHaveBeenCalledWith('/admin/commercial-config', {
    changes: [
      { key: 'campaigns.autoApproveMaxTier', value: 2 },
      { key: 'campaigns.tierThreshold1', value: 1000 },
      { key: 'campaigns.tierThreshold2', value: 6000 },
      { key: 'campaigns.tierThreshold3', value: 20000 },
      { key: 'campaigns.tierThreshold4', value: 100000 },
      { key: 'alerts.reviewEmail', value: 'review@example.test' },
    ],
    reason: 'Campaign review settings updated from platform settings',
  })
})
