import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaystackGateway } from '../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js'
import { DonationIntentEntity } from '../../src/domain/entities/DonationIntent.js'

afterEach(() => vi.unstubAllGlobals())

function captureBody() {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://pay', access_code: 'ac', reference: 'ref' } }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return () => JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body)
}
const gateway = (channels?: string[]) => new PaystackGateway({ secretKey: 'sk_test_fixture', publicKey: '', publicWebUrl: 'http://localhost', channels })
const intent = (paymentMethod?: 'card' | 'mobile_money') => new DonationIntentEntity({
  id: 'intent-1', campaignId: 'c', amount: 100, tip: 0, currency: 'GHS', status: 'CREATED', provider: 'paystack',
  donorUserId: null, donorEmail: 'd@example.test', isAnonymous: false, idempotencyKey: 'k', paymentMethod,
  createdAt: new Date(), updatedAt: new Date(),
})

// I130: checkout sent no channel list, so donors saw every dashboard channel
// (bank transfer, USSD, QR…) although the site promises card or mobile money.
describe('Paystack checkout channels', () => {
  it('offers the configured default channels', async () => {
    const body = captureBody()
    await gateway(['card', 'mobile_money']).initializeTransaction(intent())
    expect(body().channels).toEqual(['card', 'mobile_money'])
  })
  it('narrows to the method the donor chose', async () => {
    const body = captureBody()
    await gateway(['card', 'mobile_money']).initializeTransaction(intent('mobile_money'))
    expect(body().channels).toEqual(['mobile_money'])
  })
  it('applies the default to other charges unless the caller narrows it', async () => {
    let body = captureBody()
    await gateway(['card', 'mobile_money']).initializeCharge({ email: 'p@example.test', amount: 10, referencePrefix: 'wtop' })
    expect(body().channels).toEqual(['card', 'mobile_money'])
    body = captureBody()
    await gateway(['card', 'mobile_money']).initializeCharge({ email: 'p@example.test', amount: 10, referencePrefix: 'sub', channels: ['card'] })
    expect(body().channels).toEqual(['card'])
  })
  it('sends no restriction when none is configured', async () => {
    const body = captureBody()
    await gateway().initializeTransaction(intent())
    expect(body()).not.toHaveProperty('channels')
  })
})
