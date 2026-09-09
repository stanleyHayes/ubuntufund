import { createHmac, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import type { CryptoAssetInfo, CryptoWebhookEvent } from '@ubuntu-fund/types';
import type { CryptoPaymentProviderPort, CryptoQuoteRequest, CryptoDepositRequest, CryptoDepositStatus } from '../../../../domain/ports/outbound/CryptoPaymentProviderPort.js';
import { CryptoProviderDepositModel } from '../../../database/models/CryptoProviderDepositModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export interface BitnobConfig { clientId: string; clientSecret: string; webhookSecret: string; baseUrl: string; networks: string[]; quoteTtlSeconds: number }
const chainsSchema = z.object({ chains: z.array(z.object({ chain: z.string(), stablecoins: z.array(z.object({ symbol: z.string(), decimals: z.number().int().min(0).max(18) })) })) });
const depositEventSchema = z.object({ event: z.literal('deposit.success'), data: z.object({ reference: z.string().min(1), address: z.string().min(1), currency: z.enum(['USDT', 'USDC']), chain: z.string(), amount: z.string().regex(/^\d+$/), fee: z.string().regex(/^\d+$/), hash: z.string().min(1) }) });

/** Current Bitnob API: scoped HMAC auth, USDT/USDC receipts, no custody keys in the app. */
export class BitnobCryptoProvider implements CryptoPaymentProviderPort {
  readonly provider = 'bitnob' as const;
  constructor(private readonly config: BitnobConfig) {}
  isConfigured() { return !!(this.config.clientId && this.config.clientSecret && this.config.webhookSecret && this.config.networks.length); }

  private async request(path: string, body?: unknown, key?: string): Promise<unknown> {
    if (!this.isConfigured()) throw new AppError('Bitnob is not configured', 503);
    const payload = body === undefined ? '' : JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    const signature = createHmac('sha256', this.config.clientSecret).update(`${this.config.clientId}:${timestamp}:${nonce}:${payload}`).digest('hex');
    const response = await fetch(`${this.config.baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Client': this.config.clientId, 'X-Auth-Timestamp': timestamp, 'X-Auth-Nonce': nonce, 'X-Auth-Signature': signature, ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: payload }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new AppError(`Bitnob request failed (${response.status})`, 502);
    const parsed = z.object({ success: z.literal(true), data: z.unknown() }).parse(await response.json());
    return parsed.data;
  }

  private async chains() { return chainsSchema.parse(await this.request('/api/stablecoins/supported-chains')).chains.filter(c => this.config.networks.includes(c.chain) && c.chain !== 'stellar'); }

  async getSupportedAssets(): Promise<CryptoAssetInfo[]> {
    const chains = await this.chains();
    return (['USDT', 'USDC'] as const).map(asset => ({ asset, label: asset, networks: chains.filter(c => c.stablecoins.some(s => s.symbol === asset)).map(c => ({ id: c.chain.toUpperCase(), label: c.chain, requiredConfirmations: 1 })) })).filter(a => a.networks.length > 0);
  }

  async getQuote(req: CryptoQuoteRequest) {
    if (req.asset === 'BTC' || req.fiatCurrency !== 'GHS') throw new AppError('Only GHS stablecoin contributions are supported', 400);
    const chain = (await this.chains()).find(c => c.chain === req.network.toLowerCase() && c.stablecoins.some(s => s.symbol === req.asset));
    if (!chain) throw new AppError('Unsupported asset/network', 400);
    const result = z.object({ from_currency: z.string(), to_currency: z.string(), from_amount: z.string(), to_amount: z.string(), rate_used: z.string(), timestamp: z.string() }).parse(await this.request(`/api/exchange-rates/convert?from=GHS&to=${req.asset}&amount=${req.fiatAmount}`));
    const pricedAt = new Date(result.timestamp).getTime();
    if (result.from_currency !== 'GHS' || result.to_currency !== req.asset || !new Decimal(result.from_amount).eq(req.fiatAmount) || !Number.isFinite(pricedAt) || Math.abs(Date.now() - pricedAt) > 60000) throw new AppError('Invalid or stale Bitnob quote', 502);
    const amount = new Decimal(result.to_amount).toDecimalPlaces(6, Decimal.ROUND_UP);
    if (!amount.isFinite() || !amount.isPositive()) throw new AppError('Invalid Bitnob amount', 502);
    return { quoteId: `bitnob-${randomUUID()}`, asset: req.asset, network: req.network, fiatCurrency: 'GHS', fiatAmount: req.fiatAmount, cryptoAmount: amount.toNumber(), rate: new Decimal(req.fiatAmount).div(amount).toNumber(), providerFeeFiat: 0, networkFeeFiat: 0, expiresAt: new Date(Date.now() + Math.min(this.config.quoteTtlSeconds, 60) * 1000).toISOString() };
  }

  async createDeposit(req: CryptoDepositRequest) {
    const existing = await CryptoProviderDepositModel.findOne({ reference: req.reference, provider: this.provider });
    if (existing) {
      if (existing.quoteId !== req.quote.quoteId) throw new AppError('Deposit reference belongs to another quote', 409);
      return { walletAddress: existing.address };
    }
    const chain = (await this.chains()).find(c => c.chain === req.quote.network.toLowerCase());
    const token = chain?.stablecoins.find(s => s.symbol === req.quote.asset);
    if (!chain || !token) throw new AppError('Unsupported asset/network', 400);
    const result = z.object({ id: z.string(), address: z.string().min(1), chain: z.string(), reference: z.string() }).parse(await this.request('/api/addresses', { chain: chain.chain, label: req.reference, reference: req.reference }, req.reference));
    if (result.reference !== req.reference || result.chain !== chain.chain) throw new AppError('Address response does not match request', 502);
    const expectedMinor = new Decimal(req.quote.cryptoAmount).mul(new Decimal(10).pow(token.decimals));
    if (!expectedMinor.isInteger()) throw new AppError('Unsupported token precision', 400);
    try {
      await CryptoProviderDepositModel.create({ provider: this.provider, reference: req.reference, address: result.address, network: chain.chain, asset: req.quote.asset, decimals: token.decimals, expectedMinor: expectedMinor.toFixed(0), quoteId: req.quote.quoteId });
    } catch (error) {
      const winner = await CryptoProviderDepositModel.findOne({ reference: req.reference, quoteId: req.quote.quoteId });
      if (!winner || winner.address !== result.address) throw error;
    }
    return { walletAddress: result.address, providerDepositId: result.id };
  }

  async verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): Promise<CryptoWebhookEvent | null> {
    if (!this.isConfigured()) return null;
    const signature = headers['x-bitnob-signature'];
    if (typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return null;
    const expected = createHmac('sha512', this.config.webhookSecret).update(rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
    let parsed; try { parsed = depositEventSchema.safeParse(JSON.parse(rawBody)); } catch { return null; }
    if (!parsed.success) return null;
    const data = parsed.data.data;
    const mapping = await CryptoProviderDepositModel.findOne({ provider: this.provider, address: data.address, network: data.chain, asset: data.currency });
    if (!mapping) throw new AppError('Deposit mapping not ready; retry webhook', 503);
    // Persist the provider transaction reference, then verify via authenticated API.
    await CryptoProviderDepositModel.updateOne({ _id: mapping.id }, { $set: { transactionReference: data.reference } });
    const status = await this.getDeposit(mapping.reference);
    if (status.status !== 'confirmed') throw new AppError('Deposit is awaiting verification or amount review', 409);
    return { eventId: data.reference, providerRef: mapping.reference, type: 'deposit.confirmed', cryptoAmount: status.cryptoAmount, confirmations: status.confirmations, transactionHash: status.transactionHash, raw: {} };
  }

  async getDeposit(reference: string): Promise<CryptoDepositStatus> {
    const mapping = await CryptoProviderDepositModel.findOne({ reference, provider: this.provider });
    if (!mapping) return { status: 'pending' };
    const txSchema = z.object({ reference: z.string(), currency: z.string(), type: z.string(), state: z.string(), amount: z.string().regex(/^\d+$/), fee: z.string(), metadata: z.object({ address: z.string(), chain: z.string(), tx_hash: z.string().min(1), is_simulated: z.boolean().optional() }) });
    let cursor = '';
    // Bounded, paginated reconciliation; unobserved deposits stay pending, never guessed confirmed.
    for (let page = 0; page < 20; page++) {
      const response = z.object({ transactions: z.array(z.unknown()), has_more: z.boolean(), next_cursor: z.string().optional() }).parse(await this.request(`/api/transactions?type=DEPOSIT_CONFIRMED&status=SETTLED&currency=${mapping.asset}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`));
      for (const raw of response.transactions) {
        const parsed = txSchema.safeParse(raw); if (!parsed.success) continue;
        const tx = parsed.data;
        if (tx.metadata.address !== mapping.address || tx.metadata.chain !== mapping.network || tx.currency !== mapping.asset || tx.type !== 'DEPOSIT_CONFIRMED' || tx.state !== 'SETTLED') continue;
        if (process.env.NODE_ENV === 'production' && tx.metadata.is_simulated === true) continue;
        if (tx.amount !== mapping.expectedMinor || !new Decimal(tx.fee).isZero()) continue; // under/overpayments and fees need manual review
        return { status: 'confirmed', confirmations: 1, transactionHash: tx.metadata.tx_hash, cryptoAmount: new Decimal(tx.amount).div(new Decimal(10).pow(mapping.decimals)).toNumber() };
      }
      if (!response.has_more || !response.next_cursor) break;
      cursor = response.next_cursor;
    }
    return { status: 'pending' };
  }
}
