import { beforeAll, afterAll, it, expect } from 'vitest'
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js'
import { MongoBeneficiaryRecipientRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryRecipientRepository.js'
import { BeneficiaryRecipientModel } from '../../src/infrastructure/database/models/BeneficiaryRecipientModel.js'

beforeAll(connectTestDatabase)
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
it('clears stored verification evidence when replacing a beneficiary destination', async () => {
  const repo = new MongoBeneficiaryRecipientRepository()
  const recipient = { id: '', campaignId: 'campaign-reset', beneficiaryId: 'beneficiary-reset', type: 'mobile_money' as const, accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Beneficiary', recipientCode: 'synthetic-old', currency: 'GHS', kycVerified: false, createdBy: 'owner', createdAt: new Date() }
  await repo.upsert(recipient)
  await repo.setKycVerified(recipient.campaignId, recipient.beneficiaryId, 'reviewer')
  expect((await repo.findByCampaignAndBeneficiary(recipient.campaignId, recipient.beneficiaryId))?.kycVerifiedBy).toBe('reviewer')
  const replaced = await repo.upsert({ ...recipient, recipientCode: 'synthetic-new', accountNumber: '0557654321' })
  expect(replaced.kycVerified).toBe(false)
  expect(replaced.kycVerifiedBy).toBeUndefined()
  expect(replaced.kycVerifiedAt).toBeUndefined()
  const stored = await BeneficiaryRecipientModel.collection.findOne({ campaignId: recipient.campaignId })
  expect(stored).not.toHaveProperty('kycVerifiedBy')
  expect(stored).not.toHaveProperty('kycVerifiedAt')
  expect(stored?.recipientCode).toBe('synthetic-new')
  const reviewed = await repo.setKycVerified(recipient.campaignId, recipient.beneficiaryId, 'new-reviewer')
  expect(reviewed?.kycVerified).toBe(true)
  expect(reviewed?.kycVerifiedBy).toBe('new-reviewer')
  expect(reviewed?.kycVerifiedAt).toBeInstanceOf(Date)
})
