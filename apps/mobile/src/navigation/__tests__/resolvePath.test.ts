import { describe, it, expect } from 'vitest'
import { resolveNativePath } from '../resolvePath'
import { LEGAL_POLICIES } from '@ubuntu-fund/types/src/legal'
describe('incoming web and native links', () => {
  it('opens every public legal page for scheme, web and dev URLs', () => {
    for (const slug of ['legal', ...LEGAL_POLICIES.map(policy => policy.slug)]) {
      for (const prefix of ['ujimora://', 'https://app.ujimora.com/', 'exp://localhost:8081/--/']) expect(resolveNativePath(prefix + slug)).toBe('/' + slug)
    }
  })
  it('distinguishes campaign creation, details, host and viewer links', () => {
    expect(resolveNativePath('/campaigns/new')).toBe('/campaign/create')
    expect(resolveNativePath('ujimora://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A18081')).toBe('/')
    expect(resolveNativePath('/donations/refund/abc')).toBe('/refund-request?donationId=abc')
    expect(resolveNativePath('/campaigns/abc')).toBe('/campaign/abc')
    expect(resolveNativePath('/campaigns/abc/live')).toBe('/campaign/live?id=abc')
    expect(resolveNativePath('/c/test/live/room1')).toBe('/live/room1')
    expect(resolveNativePath('/c/test/donate')).toBe('/campaign/shared?slug=test&donate=1')
  })
  it('preserves payment references without trusting them as confirmation', () => {
    expect(resolveNativePath('ujimora://donate/abc?reference=pending')).toBe('/donate/abc?reference=pending')
  })
})

it('opens profile and organization links and requires subscription refresh after checkout', () => {
  expect(resolveNativePath('/profile')).toBe('/(tabs)/profile')
  expect(resolveNativePath('/organizations/example')).toBe('/organization/example')
  expect(resolveNativePath('/subscription/callback?status=success')).toBe('/(tabs)/subscription')
})
