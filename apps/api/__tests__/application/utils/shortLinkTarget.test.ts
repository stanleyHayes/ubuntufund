import { describe, expect, it } from 'vitest'
import { buildShortLinkTarget } from '../../../src/application/utils/shortLinkTarget.js'

const base = { campaignRef: 'water-for-tamale', creatorId: '64b000000000000000000001' }

describe('buildShortLinkTarget', () => {
  it('sends creator links to the creator page, never to the unrouted /u/:userId', () => {
    expect(buildShortLinkTarget('https://app.ujimora.com/', { ...base, kind: 'creator', creatorHandle: 'ama' })).toBe('https://app.ujimora.com/creators/ama')
    expect(buildShortLinkTarget('https://app.ujimora.com', { ...base, kind: 'creator' })).toBe('https://app.ujimora.com/c/water-for-tamale')
  })

  it('keeps the other kinds on the campaign page', () => {
    expect(buildShortLinkTarget('https://app.ujimora.com', { ...base, kind: 'amount', presetAmount: 25 })).toBe('https://app.ujimora.com/c/water-for-tamale/donate?amount=25')
    expect(buildShortLinkTarget('https://app.ujimora.com', { ...base, kind: 'campaign' })).toBe('https://app.ujimora.com/c/water-for-tamale')
  })
})
