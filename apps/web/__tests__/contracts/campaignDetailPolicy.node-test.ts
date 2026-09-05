import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptsCampaignDonation, validWalletDonationAmount, walletDonationProviders } from '../../src/lib/campaignDetailPolicy'

test('only active campaigns before their deadline can accept donations', () => {
  const now = Date.parse('2026-09-05T12:00:00Z')
  assert.equal(acceptsCampaignDonation({ status: 'active', endDate: '2026-09-05T12:00:01Z' }, now), true)
  for (const status of ['funded', 'expired', 'blocked', 'pending_review', 'draft']) assert.equal(acceptsCampaignDonation({ status, endDate: '2027-01-01T00:00:00Z' }, now), false)
  for (const endDate of ['2026-09-05T12:00:00Z', '2026-01-01T00:00:00Z', 'invalid']) assert.equal(acceptsCampaignDonation({ status: 'active', endDate }, now), false)
  assert.equal(acceptsCampaignDonation(null, now), false)
})
test('wallet amounts reject nonfinite, negative, zero and fractional pesewas', () => {
  for (const amount of ['', ' ', '0', '-1', 'Infinity', 'NaN', '1.001']) assert.equal(validWalletDonationAmount(amount), false, amount)
  for (const amount of ['0.01', '1.10', '150000', '50.55']) assert.equal(validWalletDonationAmount(amount), true, amount)
})
test('only the implemented wallet rail is advertised on this detail page', () => {
  assert.deepEqual(walletDonationProviders([{ slug: 'wallet', type: 'wallet' }, { slug: 'card', type: 'card' }, { slug: 'bank', type: 'bank_transfer' }, { slug: 'other-wallet', type: 'wallet' }]), [{ slug: 'wallet', type: 'wallet' }])
  assert.deepEqual(walletDonationProviders([]), [])
})
