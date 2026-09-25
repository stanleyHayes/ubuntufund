import { describe, expect, it, vi } from 'vitest'
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), dismissTo: vi.fn() }))
vi.mock('expo-router', () => ({ router }))
import { completeSignIn, currentHref, safeReturnTo, signInHref } from '../returnTo'

describe('post-sign-in destination', () => {
  it('accepts in-app paths with their query parameters', () => {
    expect(safeReturnTo('/refund-request?donationId=abc')).toBe('/refund-request?donationId=abc')
    expect(safeReturnTo('/campaign/65f0c0ffee')).toBe('/campaign/65f0c0ffee')
    expect(safeReturnTo(['/wallet', '/other'])).toBe('/wallet')
  })

  it('rejects external, protocol-relative, auth-screen and malformed destinations', () => {
    for (const value of ['//evil.com', 'https://evil.com', 'ujimora://wallet', 'wallet', '/(auth)/login', '/(auth)/register?ref=x', '/login', '/register', '/\\evil.com', '/a\nb', '/' + 'a'.repeat(600), 42, null, undefined, {}]) {
      expect(safeReturnTo(value)).toBeNull()
    }
  })

  it('builds the sign-in route and the post-sign-in fallback', () => {
    expect(signInHref('/my-refunds')).toEqual({ pathname: '/(auth)/login', params: { returnTo: '/my-refunds' } })
    expect(signInHref('https://evil.com')).toBe('/(auth)/login')
    expect(signInHref()).toBe('/(auth)/login')
    completeSignIn('/wallet')
    expect(router.dismissTo).toHaveBeenCalledWith('/wallet')
    completeSignIn('//evil.com')
    completeSignIn(undefined)
    expect(router.replace).toHaveBeenCalledTimes(2)
    expect(router.replace).toHaveBeenCalledWith('/(tabs)')
    expect(router.dismissTo).toHaveBeenCalledTimes(1)
  })

  it('serializes the current route and its search params', () => {
    expect(currentHref('/refund-request', { donationId: 'abc', empty: undefined })).toBe('/refund-request?donationId=abc')
    expect(currentHref('/wallet')).toBe('/wallet')
    expect(currentHref('/x', { tag: ['a', 'b'] })).toBe('/x?tag=a&tag=b')
    expect(currentHref('/campaign/abc', { id: 'abc', tab: 'updates' }, ['campaign', '[id]'])).toBe('/campaign/abc?tab=updates')
  })
})
