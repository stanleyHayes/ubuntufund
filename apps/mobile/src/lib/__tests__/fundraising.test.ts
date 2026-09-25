import { describe, expect, it } from 'vitest'
import { campaignShareUrl, fundraisingUrl, sessionGoalLine, walletFundingUrl } from '../fundraising'

describe('external fundraising handoff', () => {
  it('passes only public campaign context to the donation route', () => {
    const url = new URL(fundraisingUrl('school-project', { amount: '10.50', liveSessionId: 'a'.repeat(24) }, 'https://app.ujimora.com'))
    expect(url.pathname).toBe('/c/school-project/donate')
    expect([...url.searchParams.entries()]).toEqual([['amount', '10.5'], ['liveSessionId', 'a'.repeat(24)]])
  })
  it('does not allow slug characters or invalid presets to add query parameters', () => {
    const url = new URL(fundraisingUrl('school?token=secret', { amount: '-5', liveSessionId: 'invalid' }, 'https://app.ujimora.com'))
    expect(url.pathname).toContain('school%3Ftoken%3Dsecret')
    expect(url.search).toBe('')
  })
  it('rejects insecure or credential-bearing website configuration', () => {
    for (const origin of ['http://app.ujimora.com', 'https://user:password@app.ujimora.com', 'ujimora://donate']) {
      expect(() => fundraisingUrl('school', {}, origin)).toThrow()
    }
    expect(() => fundraisingUrl('', {}, 'https://app.ujimora.com')).toThrow()
  })
  it('sends iOS wallet funding to the website wallet without account context', () => {
    expect(walletFundingUrl('https://app.ujimora.com/some/path?x=1')).toBe('https://app.ujimora.com/wallet')
    expect(() => walletFundingUrl('http://app.ujimora.com')).toThrow()
  })
  it('describes a live session goal, with progress only while amounts are shown', () => {
    const goal = (2000).toLocaleString()
    expect(sessionGoalLine({ targetAmount: 2000, amountRaised: 500, currency: 'GHS' })).toBe(`Session goal: GHS ${goal} · 25% reached`)
    expect(sessionGoalLine({ targetAmount: 2000, amountRaised: 2600 })).toBe(`Session goal: GHS ${goal} · 100% reached`)
    expect(sessionGoalLine({ targetAmount: 2000, amountRaised: null, currency: 'GHS' })).toBe(`Session goal: GHS ${goal}`)
    expect(sessionGoalLine({ amountRaised: 500 })).toBeNull()
    expect(sessionGoalLine({ targetAmount: 0, amountRaised: 500 })).toBeNull()
  })
  it('shares the public web campaign page, preferring the slug', () => {
    expect(campaignShareUrl({ id: 'abc', slug: 'school fees' }, 'https://app.ujimora.com')).toBe('https://app.ujimora.com/c/school%20fees')
    expect(campaignShareUrl({ id: 'abc' }, 'https://app.ujimora.com')).toBe('https://app.ujimora.com/campaigns/abc')
  })
})
