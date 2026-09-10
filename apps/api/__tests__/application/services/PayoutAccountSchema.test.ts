import { expect, it } from 'vitest'
import mongoose from 'mongoose'
import '../../../src/infrastructure/adapters/outbound/persistence/MongoPayoutAccountRepository.js'
it('stores bank and MoMo destinations as records rather than casting them to strings', () => {
  const Model = mongoose.model('PayoutAccountWallet')
  const doc = new Model({ _id: 'owner-id', userId: 'owner-id', accounts: ['mobile_money', 'ghipss'].map((type, i) => ({ id: `saved-${i}`, fingerprint: `fp-${i}`, type, accountNumber: '0000000000', bankCode: 'TEST', accountName: 'Test Account', recipientCode: 'TEST_RECIPIENT', verificationStatus: 'name_matched' })) })
  expect(doc.validateSync()).toBeUndefined()
  expect(doc.accounts[0].type).toBe('mobile_money')
  expect(doc.accounts[1].id).toBe('saved-1')
})
