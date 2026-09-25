import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../api', () => ({ api, ApiError: class extends Error { status = 0 } }))
import { affiliateDestinationChoices, listSavedPayoutAccounts, setAffiliatePayoutRecipient } from '../affiliate'

const matched = { id: 'a1', accountName: 'Kwame Mensah', last4: '4567', bankCode: 'MTN', verificationStatus: 'name_matched' }
const unmatched = { id: 'a2', accountName: 'Someone', last4: '1111', bankCode: 'MTN', verificationStatus: 'needs_review' }

describe('affiliate payout destination (native)', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset() })

  it('offers only name-matched saved accounts', () => {
    expect(affiliateDestinationChoices([unmatched, matched])).toEqual({ selectable: [matched], blocked: [unmatched] })
    expect(affiliateDestinationChoices([]).selectable).toEqual([])
  })

  it('reads saved accounts and sets the destination by saved account id', async () => {
    api.get.mockResolvedValue({ planName: 'Free', limit: 2, accounts: [matched] })
    api.post.mockResolvedValue({ id: 'aff', recipientCode: 'RCP_1' })
    expect(await listSavedPayoutAccounts()).toEqual([matched])
    expect(api.get).toHaveBeenCalledWith('/payout-accounts')
    await setAffiliatePayoutRecipient('a1')
    expect(api.post).toHaveBeenCalledWith('/affiliate/payout-recipient', { savedAccountId: 'a1' })
  })
})
