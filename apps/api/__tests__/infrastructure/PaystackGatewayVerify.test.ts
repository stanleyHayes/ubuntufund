import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaystackGateway } from '../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js'
import { ProviderTransactionNotFoundError } from '../../src/domain/errors/ProviderTransactionNotFoundError.js'

const gateway = new PaystackGateway({ secretKey: 'sk_test_fixture', publicKey: '', publicWebUrl: 'http://localhost' })

afterEach(() => vi.unstubAllGlobals())

function reply(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
}

describe('PaystackGateway.verifyTransaction outcomes', () => {
  it('reports an unknown reference as a typed not-found, not a transient error', async () => {
    reply(400, { status: false, message: 'Transaction reference not found' })
    await expect(gateway.verifyTransaction('uf-x')).rejects.toBeInstanceOf(ProviderTransactionNotFoundError)
  })

  it('keeps other provider rejections transient', async () => {
    reply(400, { status: false, message: 'Invalid key' })
    await expect(gateway.verifyTransaction('uf-x')).rejects.not.toBeInstanceOf(ProviderTransactionNotFoundError)
    reply(503, { status: false, message: 'Service unavailable' })
    await expect(gateway.verifyTransaction('uf-x')).rejects.toMatchObject({ statusCode: 502 })
  })

  it('parses a found transaction from minor units', async () => {
    reply(200, { status: true, data: { status: 'abandoned', reference: 'uf-x', amount: 22000, fees: 0, currency: 'GHS' } })
    await expect(gateway.verifyTransaction('uf-x')).resolves.toMatchObject({ status: 'abandoned', amount: 220 })
  })
})
