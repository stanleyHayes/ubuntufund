import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaystackGateway } from '../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js'

const gateway = new PaystackGateway({
  secretKey: 'sk_test_fixture',
  publicKey: '',
  publicWebUrl: 'http://localhost',
})

afterEach(() => vi.unstubAllGlobals())

/** Capture the JSON body the gateway posts to Paystack. */
function captureBody(response: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return () => JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body)
}

const initOk = {
  status: true,
  data: { authorization_url: 'https://pay', access_code: 'ac', reference: 'ref' },
}
const transferOk = {
  status: true,
  data: { transfer_code: 'TRF_x', status: 'success', reference: 'ref' },
}

describe('PaystackGateway currency handling', () => {
  // The scale and the label must come from ONE value. Scaling by the caller's
  // currency while still labelling the request GHS would turn an exponent bug
  // into a mislabelled charge, which is strictly worse.
  it('charges in the caller currency, scaling and labelling from the same value', async () => {
    const body = captureBody(initOk)
    await gateway.initializeCharge({
      email: 'payer@example.test',
      amount: 12.34,
      currency: 'USD',
      referencePrefix: 'sub',
    })
    expect(body()).toMatchObject({ amount: 1234, currency: 'USD' })
  })

  it('scales a zero-decimal currency by its own exponent, not by 100', async () => {
    // XOF has no minor units: 5000 XOF is 5000, not 500000. The old hardcoded
    // *100 would have sent one hundred times the amount.
    const body = captureBody(initOk)
    await gateway.initializeCharge({
      email: 'payer@example.test',
      amount: 5000,
      currency: 'XOF',
      referencePrefix: 'sub',
    })
    expect(body()).toMatchObject({ amount: 5000, currency: 'XOF' })
  })

  it('falls back to the platform currency when none is given', async () => {
    const body = captureBody(initOk)
    await gateway.initializeCharge({
      email: 'payer@example.test',
      amount: 10,
      referencePrefix: 'wtop',
    })
    expect(body()).toMatchObject({ amount: 1000, currency: 'GHS' })
  })

  it('transfers in the payout currency rather than always GHS', async () => {
    const body = captureBody(transferOk)
    await gateway.initiateTransfer({
      amount: 250.5,
      currency: 'USD',
      recipientCode: 'RCP_test',
      reference: 'pout-test',
    })
    expect(body()).toMatchObject({ amount: 25050, currency: 'USD' })
  })

  it('keeps GHS transfers byte-identical to the previous behaviour', async () => {
    const body = captureBody(transferOk)
    await gateway.initiateTransfer({
      amount: 965,
      recipientCode: 'RCP_test',
      reference: 'pout-test',
    })
    expect(body()).toMatchObject({ amount: 96500, currency: 'GHS' })
  })
})
