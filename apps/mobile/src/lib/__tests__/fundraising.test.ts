import { describe, expect, it } from 'vitest'
import { fundraisingUrl } from '../fundraising'

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
})
