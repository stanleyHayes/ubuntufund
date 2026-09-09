const test = require('node:test');
const assert = require('node:assert/strict');
const { CreateCryptoQuoteUseCase } = require('../../src/application/use-cases/CreateCryptoQuoteUseCase.ts');
const { CreateCryptoDepositUseCase } = require('../../src/application/use-cases/CreateCryptoDepositUseCase.ts');
const { GetCryptoAssetsUseCase } = require('../../src/application/use-cases/GetCryptoAssetsUseCase.ts');

test('quote discovery can fail over but deposits stay pinned to the quoted provider', async () => {
  const config = { enabled: true, allowedAssets: ['USDT'], minGhs: 1, maxGhs: 1000 };
  const quote = { quoteId: 'quote', asset: 'USDT', network: 'SOLANA', fiatCurrency: 'GHS', fiatAmount: 100, cryptoAmount: 10, rate: 10, expiresAt: new Date(Date.now() + 60000).toISOString() };
  const primary = { provider: 'bitnob', isConfigured: () => true, getSupportedAssets: async () => { throw new Error('Unavailable'); }, createDeposit: async () => { throw new Error('Must not move deposit to another provider'); } };
  let selected = '';
  const fallback = { provider: 'yellowcard', isConfigured: () => true, getSupportedAssets: async () => [{ asset: 'USDT', label: 'USDT', networks: [{ id: 'SOLANA', label: 'Solana', requiredConfirmations: 1 }] }], getQuote: async () => quote, createDeposit: async () => { selected = 'yellowcard'; return { walletAddress: 'test-address' }; } };
  const campaign = { findById: async () => ({ canReceiveDonation: () => true, goalAmount: { currency: 'GHS' } }) };
  let stored: any;
  const quotes = { save: async (q: any) => { stored = q; }, findByQuoteId: async () => stored };
  const intents = { findByIdempotencyKey: async () => null, create: async (i: any) => i };
  assert.equal((await new GetCryptoAssetsUseCase(primary, config, [fallback]).execute()).enabled, true);
  await new CreateCryptoQuoteUseCase(primary, config, campaign, quotes, [fallback]).execute('campaign', { fiatAmount: 100, asset: 'USDT', network: 'SOLANA' });
  assert.equal(stored.provider, 'yellowcard');
  await new CreateCryptoDepositUseCase(primary, config, campaign, quotes, intents, new Map([['yellowcard', fallback]])).execute('campaign', { quoteId: 'quote' }, { idempotencyKey: 'request-1' });
  assert.equal(selected, 'yellowcard');
});
