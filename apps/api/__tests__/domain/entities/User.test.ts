import { describe, it, expect } from 'vitest'
import { UserEntity } from '../../../src/domain/entities/User.js'
import { Email } from '../../../src/domain/value-objects/Email.js'
import { TrustScore } from '../../../src/domain/value-objects/TrustScore.js'
import { UserRole, VerificationLevel } from '@ubuntu-fund/types'

function makeUser(overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {}) {
  return new UserEntity({
    id: 'user-1',
    email: new Email('test@example.com'),
    name: 'Test User',
    passwordHash: 'hashed-password',
    role: UserRole.USER,
    verificationLevel: VerificationLevel.NATIONAL_ID,
    trustScore: TrustScore.default(),
    emailVerified: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  })
}

describe('UserEntity', () => {
  describe('canCreateCampaign', () => {
    it('returns true when user has not reached their verification limit', () => {
      const user = makeUser({ verificationLevel: VerificationLevel.NATIONAL_ID })
      // NATIONAL_ID (level 2) allows up to 3 campaigns
      expect(user.canCreateCampaign(0)).toBe(true)
      expect(user.canCreateCampaign(1)).toBe(true)
      expect(user.canCreateCampaign(2)).toBe(true)
    })

    it('returns false when user has reached their verification limit', () => {
      const user = makeUser({ verificationLevel: VerificationLevel.NATIONAL_ID })
      expect(user.canCreateCampaign(3)).toBe(false)
      expect(user.canCreateCampaign(5)).toBe(false)
    })

    it('returns false for NONE verification level', () => {
      const user = makeUser({ verificationLevel: VerificationLevel.NONE })
      expect(user.canCreateCampaign(0)).toBe(false)
    })

    it('allows EMAIL_PHONE to create 1 campaign', () => {
      const user = makeUser({ verificationLevel: VerificationLevel.EMAIL_PHONE })
      expect(user.canCreateCampaign(0)).toBe(true)
      expect(user.canCreateCampaign(1)).toBe(false)
    })

    it('allows COMMUNITY to create up to 25 campaigns', () => {
      const user = makeUser({ verificationLevel: VerificationLevel.COMMUNITY })
      expect(user.canCreateCampaign(24)).toBe(true)
      expect(user.canCreateCampaign(25)).toBe(false)
    })
  })

  describe('getCampaignLimit', () => {
    it('returns the correct limit for each verification level', () => {
      expect(makeUser({ verificationLevel: VerificationLevel.NONE }).getCampaignLimit()).toBe(0)
      expect(makeUser({ verificationLevel: VerificationLevel.EMAIL_PHONE }).getCampaignLimit()).toBe(1)
      expect(makeUser({ verificationLevel: VerificationLevel.NATIONAL_ID }).getCampaignLimit()).toBe(3)
      expect(makeUser({ verificationLevel: VerificationLevel.INSTITUTIONAL }).getCampaignLimit()).toBe(10)
      expect(makeUser({ verificationLevel: VerificationLevel.COMMUNITY }).getCampaignLimit()).toBe(25)
    })
  })

  describe('updateTrustScore', () => {
    it('updates the trust score', () => {
      const user = makeUser()
      const newScore = new TrustScore(80)
      user.updateTrustScore(newScore)
      expect(user.trustScore.value).toBe(80)
    })

    it('updates the updatedAt timestamp', () => {
      const user = makeUser()
      const before = user.updatedAt
      user.updateTrustScore(new TrustScore(90))
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })
  })

  describe('verifyEmail', () => {
    it('sets emailVerified to true', () => {
      const user = makeUser({ emailVerified: false })
      user.verifyEmail()
      expect(user.emailVerified).toBe(true)
    })
  })

  describe('isAdmin', () => {
    it('returns true for admin role', () => {
      const user = makeUser({ role: UserRole.ADMIN })
      expect(user.isAdmin()).toBe(true)
    })

    it('returns false for non-admin roles', () => {
      const user = makeUser({ role: UserRole.USER })
      expect(user.isAdmin()).toBe(false)
    })
  })
})
