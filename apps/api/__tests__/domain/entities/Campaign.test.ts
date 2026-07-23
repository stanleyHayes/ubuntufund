import { describe, it, expect } from 'vitest'
import { CampaignEntity } from '../../../src/domain/entities/Campaign.js'
import { Money } from '../../../src/domain/value-objects/Money.js'
import {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
} from '@ubuntu-fund/types'

function makeCampaign(overrides: Partial<ConstructorParameters<typeof CampaignEntity>[0]> = {}) {
  return new CampaignEntity({
    id: 'camp-1',
    title: 'Test Campaign',
    description: 'A test campaign',
    goalAmount: new Money(10000, 'KES'),
    raisedAmount: new Money(0, 'KES'),
    category: CampaignCategory.COMMUNITY,
    priority: CampaignPriority.NORMAL,
    status: CampaignStatus.ACTIVE,
    creatorId: 'user-1',
    beneficiaries: ['Community A'],
    imageUrls: [],
    startDate: new Date('2025-01-01'),
    endDate: new Date('2027-12-31'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  })
}

describe('CampaignEntity', () => {
  describe('canReceiveDonation', () => {
    it('returns true for an active, non-expired campaign', () => {
      const campaign = makeCampaign()
      expect(campaign.canReceiveDonation()).toBe(true)
    })

    it('returns false for a blocked campaign', () => {
      const campaign = makeCampaign({ status: CampaignStatus.BLOCKED })
      expect(campaign.canReceiveDonation()).toBe(false)
    })

    it('returns false for a funded campaign', () => {
      const campaign = makeCampaign({ status: CampaignStatus.FUNDED })
      expect(campaign.canReceiveDonation()).toBe(false)
    })

    it('returns false for an expired campaign', () => {
      const campaign = makeCampaign({
        endDate: new Date('2020-01-01'),
      })
      expect(campaign.canReceiveDonation()).toBe(false)
    })
  })

  describe('addDonation', () => {
    it('increases the raised amount', () => {
      const campaign = makeCampaign({
        raisedAmount: new Money(1000, 'KES'),
      })
      campaign.addDonation(new Money(500, 'KES'))
      expect(campaign.raisedAmount.amount).toBe(1500)
    })

    it('sets status to funded when goal is reached', () => {
      const campaign = makeCampaign({
        goalAmount: new Money(1000, 'KES'),
        raisedAmount: new Money(900, 'KES'),
      })
      campaign.addDonation(new Money(100, 'KES'))
      expect(campaign.status).toBe(CampaignStatus.FUNDED)
    })

    it('throws when campaign cannot receive donations', () => {
      const campaign = makeCampaign({ status: CampaignStatus.BLOCKED })
      expect(() => campaign.addDonation(new Money(100, 'KES'))).toThrow(
        'Campaign cannot receive donations'
      )
    })
  })

  describe('block', () => {
    it('changes status to blocked', () => {
      const campaign = makeCampaign()
      campaign.block()
      expect(campaign.status).toBe(CampaignStatus.BLOCKED)
    })

    it('updates the updatedAt timestamp', () => {
      const campaign = makeCampaign()
      const before = campaign.updatedAt
      campaign.block()
      expect(campaign.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      )
    })
  })

  describe('activate', () => {
    it('activates a pending_review campaign', () => {
      const campaign = makeCampaign({
        status: CampaignStatus.PENDING_REVIEW,
      })
      campaign.activate()
      expect(campaign.status).toBe(CampaignStatus.ACTIVE)
    })

    it('throws when campaign is not pending_review', () => {
      const campaign = makeCampaign({ status: CampaignStatus.ACTIVE })
      expect(() => campaign.activate()).toThrow(
        'Only pending campaigns can be activated'
      )
    })
  })

  describe('isFunded', () => {
    it('returns true when raised equals goal', () => {
      const campaign = makeCampaign({
        goalAmount: new Money(1000, 'KES'),
        raisedAmount: new Money(1000, 'KES'),
      })
      expect(campaign.isFunded()).toBe(true)
    })

    it('returns false when raised is below goal', () => {
      const campaign = makeCampaign({
        goalAmount: new Money(1000, 'KES'),
        raisedAmount: new Money(500, 'KES'),
      })
      expect(campaign.isFunded()).toBe(false)
    })
  })
})
