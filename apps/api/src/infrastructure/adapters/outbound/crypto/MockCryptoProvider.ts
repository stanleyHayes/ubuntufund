import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  CryptoAsset,
  CryptoAssetInfo,
  CryptoProvider,
  CryptoQuote,
  CryptoWebhookEvent,
} from '@ubuntu-fund/types';
import type {
  CryptoDepositRequest,
  CryptoDepositResult,
  CryptoDepositStatus,
  CryptoPaymentProviderPort,
  CryptoQuoteRequest,
} from '../../../../domain/ports/outbound/CryptoPaymentProviderPort.js';

/** Deterministic sandbox rates (GHS per 1 unit of asset). */
const MOCK_RATES: Record<CryptoAsset, number> = {
  USDT: 10.8,
  USDC: 10.8,
  BTC: 900_000,
};

/** Sandbox asset → networks + (small, test-friendly) required confirmations. */
const MOCK_ASSETS: CryptoAssetInfo[] = [
  {
    asset: 'USDT',
    label: 'Tether (USDT)',
    networks: [
      { id: 'TRON', label: 'Tron (TRC-20)', requiredConfirmations: 1 },
      { id: 'ETHEREUM', label: 'Ethereum (ERC-20)', requiredConfirmations: 3 },
      { id: 'BSC', label: 'BNB Smart Chain (BEP-20)', requiredConfirmations: 3 },
    ],
  },
  {
    asset: 'USDC',
    label: 'USD Coin (USDC)',
    networks: [
      { id: 'ETHEREUM', label: 'Ethereum (ERC-20)', requiredConfirmations: 3 },
      { id: 'BSC', label: 'BNB Smart Chain (BEP-20)', requiredConfirmations: 3 },
      { id: 'TRON', label: 'Tron (TRC-20)', requiredConfirmations: 1 },
    ],
  },
  {
    asset: 'BTC',
    label: 'Bitcoin (BTC)',
    networks: [{ id: 'BITCOIN', label: 'Bitcoin', requiredConfirmations: 2 }],
  },
];

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Built-in sandbox crypto provider. It implements the full
 * {@link CryptoPaymentProviderPort} deterministically — quotes at fixed rates,
 * issues a mock address, and verifies webhooks with an HMAC-SHA256 signature —
 * so the end-to-end crypto flow (quote → deposit → confirm → settle) can run and
 * be tested locally with no external account. Real providers (Yellow Card /
 * Paychant / Bitnob) implement the same port and drop in behind it.
 */
export class MockCryptoProvider implements CryptoPaymentProviderPort {
  readonly provider: CryptoProvider = 'mock';

  constructor(
    private readonly webhookSecret: string,
    private readonly quoteTtlSeconds: number
  ) {}

  /** The sandbox is always "configured" — it needs no external secrets. */
  isConfigured(): boolean {
    return true;
  }

  async getSupportedAssets(): Promise<CryptoAssetInfo[]> {
    return MOCK_ASSETS.map((a) => ({ ...a, networks: a.networks.map((n) => ({ ...n })) }));
  }

  async getQuote(req: CryptoQuoteRequest): Promise<CryptoQuote> {
    const rate = MOCK_RATES[req.asset];
    // Crypto precision: 6 dp for stablecoins, 8 dp for BTC.
    const dp = req.asset === 'BTC' ? 8 : 6;
    const providerFeeFiat = round(req.fiatAmount * 0.005, 2); // 0.5% mock provider fee
    const networkFeeFiat = 1; // flat mock network fee
    const cryptoAmount = round(req.fiatAmount / rate, dp);
    return {
      quoteId: `mock-q-${randomUUID()}`,
      asset: req.asset,
      network: req.network,
      fiatCurrency: req.fiatCurrency,
      fiatAmount: round(req.fiatAmount, 2),
      cryptoAmount,
      rate,
      providerFeeFiat,
      networkFeeFiat,
      expiresAt: new Date(Date.now() + this.quoteTtlSeconds * 1000).toISOString(),
    };
  }

  async createDeposit(req: CryptoDepositRequest): Promise<CryptoDepositResult> {
    // Deterministic sandbox address keyed off the network + our reference.
    return {
      walletAddress: `MOCK-${req.quote.network}-${req.reference}`,
      providerDepositId: `mock-dep-${randomUUID()}`,
    };
  }

  async getDeposit(_reference: string): Promise<CryptoDepositStatus> {
    // Sandbox: a polled deposit is treated as confirmed with ample confirmations
    // (there is no real chain to observe), so reconciliation can settle a
    // deposit whose webhook was missed. A REAL adapter returns the provider's
    // actual on-chain status here.
    return { status: 'confirmed', confirmations: 999 };
  }

  /** Sign a raw body the way this provider expects (exposed for tests). */
  static sign(rawBody: string, secret: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): CryptoWebhookEvent | null {
    const provided = headers['x-mock-signature'];
    const sig = Array.isArray(provided) ? provided[0] : provided;
    if (!sig) return null;
    const expected = MockCryptoProvider.sign(rawBody, this.webhookSecret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    let body: {
      id?: string;
      type?: string;
      reference?: string;
      transactionHash?: string;
      cryptoAmount?: number;
      confirmations?: number;
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (
      !body.id ||
      !body.reference ||
      (body.type !== 'deposit.detected' &&
        body.type !== 'deposit.confirmed' &&
        body.type !== 'deposit.failed')
    ) {
      return null;
    }
    return {
      eventId: body.id,
      type: body.type,
      providerRef: body.reference,
      transactionHash: body.transactionHash,
      cryptoAmount: body.cryptoAmount,
      confirmations: body.confirmations,
      raw: body as Record<string, unknown>,
    };
  }
}
