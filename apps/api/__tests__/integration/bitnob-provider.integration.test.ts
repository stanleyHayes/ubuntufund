import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { BitnobCryptoProvider } from '../../src/infrastructure/adapters/outbound/crypto/BitnobCryptoProvider.js';
import { CryptoProviderDepositModel } from '../../src/infrastructure/database/models/CryptoProviderDepositModel.js';
const config = { clientId: 'test-client', clientSecret: 'test-secret', webhookSecret: 'webhook-secret', baseUrl: 'https://api.bitnob.com', networks: ['solana'], quoteTtlSeconds: 60 };
const provider = new BitnobCryptoProvider(config);
beforeAll(async () => { await connectTestDatabase(); await CryptoProviderDepositModel.init(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
afterEach(() => vi.unstubAllGlobals());

describe('Bitnob current API contract', () => {
  it('signs calls, quotes stablecoins, persists unique addresses and verifies settled receipts', async () => {
    let received = '10000000'; let currency = 'USDT';
    const mock = vi.fn(async (url: string, opts: RequestInit) => {
      const headers = opts.headers as Record<string, string>;
      const expected = createHmac('sha256', config.clientSecret).update(`${config.clientId}:${headers['X-Auth-Timestamp']}:${headers['X-Auth-Nonce']}:${opts.body ?? ''}`).digest('hex');
      expect(headers['X-Auth-Signature']).toBe(expected);
      let data: unknown;
      if (url.includes('/supported-chains')) data = { chains: [{ chain: 'solana', stablecoins: [{ symbol: 'USDT', decimals: 6 }, { symbol: 'USDC', decimals: 6 }] }, { chain: 'stellar', stablecoins: [{ symbol: 'USDC', decimals: 7 }] }] };
      else if (url.includes('/convert')) data = { from_currency: 'GHS', to_currency: 'USDT', from_amount: '100', to_amount: '10', rate_used: '.1', timestamp: new Date().toISOString() };
      else if (url.endsWith('/addresses')) { expect(headers['Idempotency-Key']).toBe('cryp-test'); data = { id: 'addr-id', address: 'sandbox-address', chain: 'solana', reference: 'cryp-test' }; }
      else data = { transactions: [{ reference: 'deposit-1', currency, type: 'DEPOSIT_CONFIRMED', state: 'SETTLED', amount: received, fee: '0', metadata: { address: 'sandbox-address', chain: 'solana', tx_hash: 'hash' } }], has_more: false };
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    });
    vi.stubGlobal('fetch', mock);
    expect(await provider.getSupportedAssets()).toHaveLength(2);
    const quote = await provider.getQuote({ fiatAmount: 100, fiatCurrency: 'GHS', asset: 'USDT', network: 'SOLANA' });
    expect(quote.cryptoAmount).toBe(10);
    await provider.createDeposit({ reference: 'cryp-test', quote });
    await provider.createDeposit({ reference: 'cryp-test', quote });
    expect(mock.mock.calls.filter(c => c[0].endsWith('/addresses'))).toHaveLength(1);
    const body = JSON.stringify({ event: 'deposit.success', data: { reference: 'deposit-1', address: 'sandbox-address', currency: 'USDT', chain: 'solana', amount: '10000000', fee: '0', hash: 'hash' } });
    const headers = { 'x-bitnob-signature': createHmac('sha512', config.webhookSecret).update(body).digest('hex') };
    expect(await provider.verifyWebhook({ 'x-bitnob-signature': 'bad' }, body)).toBeNull();
    expect(await provider.verifyWebhook(headers, body)).toMatchObject({ providerRef: 'cryp-test', type: 'deposit.confirmed', cryptoAmount: 10 });
    received = '9000000'; expect((await provider.getDeposit('cryp-test')).status).toBe('pending');
    received = '11000000'; expect((await provider.getDeposit('cryp-test')).status).toBe('pending');
    received = '10000000'; currency = 'USDC'; expect((await provider.getDeposit('cryp-test')).status).toBe('pending');
  });
  it('fails closed without keys and rejects unsupported pairs', async () => {
    expect(new BitnobCryptoProvider({ ...config, clientSecret: '' }).isConfigured()).toBe(false);
    await expect(provider.getQuote({ fiatAmount: 100, fiatCurrency: 'USD', asset: 'USDT', network: 'SOLANA' })).rejects.toThrow('Only GHS');
  });
});
