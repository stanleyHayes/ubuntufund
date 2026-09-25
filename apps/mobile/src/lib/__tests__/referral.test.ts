import { describe, expect, it } from 'vitest'
import { signupReferralCode } from '../referral'

describe('sign-up referral code', () => {
  it('sends a valid code normalised', () => {
    expect(signupReferralCode('  Ama-Fund ')).toBe('ama-fund')
  })
  it('never lets an optional code the API would reject block sign-up', () => {
    expect(signupReferralCode('ab')).toBeUndefined()
    expect(signupReferralCode('a'.repeat(25))).toBeUndefined()
    expect(signupReferralCode('Accra Marathon 2026 water station')).toBeUndefined()
    expect(signupReferralCode('admin')).toBeUndefined()
    expect(signupReferralCode('')).toBeUndefined()
    expect(signupReferralCode(undefined)).toBeUndefined()
  })
})
