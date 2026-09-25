import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_REPORT_REASONS } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { campaignReportOptions, campaignReportPayload, reportCampaign } from '../campaignReport'

describe('native campaign report payload', () => {
  beforeEach(() => { vi.mocked(api.post).mockReset().mockResolvedValue(null) })

  it('offers exactly the reasons the API validator accepts, with readable labels', () => {
    expect(campaignReportOptions.map(o => o.value)).toEqual([...CAMPAIGN_REPORT_REASONS])
    for (const option of campaignReportOptions) expect(option.label).not.toMatch(/_/)
  })

  it('only ever sends a shared reason and trims optional details', () => {
    for (const reason of CAMPAIGN_REPORT_REASONS) {
      const body = campaignReportPayload(reason, '  Photos are copied from another campaign.  ')
      expect(CAMPAIGN_REPORT_REASONS).toContain(body.reason)
      expect(body.description).toBe('Photos are copied from another campaign.')
    }
    expect(campaignReportPayload('spam', '   ')).toEqual({ reason: 'spam' })
  })

  it('refuses free-text reasons such as the old "Flagged from mobile" and over-long details', () => {
    expect(() => campaignReportPayload('Flagged from mobile')).toThrow('Choose a reason')
    expect(() => campaignReportPayload('')).toThrow('Choose a reason')
    expect(() => campaignReportPayload('other', 'x'.repeat(2001))).toThrow('2,000')
  })

  it('posts the validated body to the campaign report endpoint and surfaces server errors', async () => {
    await reportCampaign('abc123', 'misleading', 'Goal amount changed')
    expect(api.post).toHaveBeenCalledWith('/campaigns/abc123/report', { reason: 'misleading', description: 'Goal amount changed' })
    vi.mocked(api.post).mockRejectedValueOnce(new Error('You have already reported this campaign'))
    await expect(reportCampaign('abc123', 'spam')).rejects.toThrow('already reported')
    await expect(reportCampaign('abc123', 'Flagged from mobile')).rejects.toThrow('Choose a reason')
    expect(api.post).toHaveBeenCalledTimes(2)
  })
})
