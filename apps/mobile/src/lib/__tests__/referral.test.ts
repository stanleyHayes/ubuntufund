import { describe, expect, it } from 'vitest'
import { referralShareMessage, signupReferralCode } from '../referral'

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

describe('referral share text', () => {
  it('spells out the code for people who sign up in the app, since the https link opens the website', () => {
    expect(referralShareMessage('https://app.ujimora.com?ref=ama-fund', 'ama-fund'))
      .toBe('https://app.ujimora.com?ref=ama-fund\nSigning up in the Ujimora app? Enter referral code ama-fund.')
  })
})
