import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DonationIntentEntity } from '../../../../domain/entities/DonationIntent.js';
import type {
  CreateTransferRecipientParams,
  InitializeChargeParams,
  InitiateTransferParams,
  PaymentGatewayBalance,
  PaymentGatewayBank,
  PaymentGatewayInitResult,
  PaymentGatewayPort,
  PaymentGatewayRefundResult,
  PaymentGatewayTransferResult,
  PaymentGatewayVerifyResult,
  ProviderCapabilities,
} from '../../../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { logger } from '../../../logging/logger.js';
import { toMinorUnits, fromMinorUnits } from '../../../../domain/value-objects/Money.js';

export interface PaystackGatewayConfig {
  /** Server-only secret key. Empty ⇒ the gateway is disabled. */
  secretKey: string;
  publicKey: string;
  /** Donor-facing web app base URL; builds the checkout callback target. */
  publicWebUrl: string;
}

/** Shape of Paystack's `{ status, message, data }` envelope. */
interface PaystackEnvelope<T> {
  status?: boolean;
  message?: string;
  data?: T;
}

interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface PaystackVerifyData {
  status: string;
  reference: string;
  amount: number;
  fees?: number;
  currency: string;
  [key: string]: unknown;
}

interface PaystackBankData {
  name: string;
  code: string;
  currency?: string;
  type?: string;
  active?: boolean;
  [key: string]: unknown;
}

interface PaystackRecipientData {
  recipient_code: string;
  [key: string]: unknown;
}

interface PaystackTransferData {
  transfer_code: string;
  status: string;
  reference: string;
  [key: string]: unknown;
}

interface PaystackBalanceData {
  currency: string;
  balance: number;
  [key: string]: unknown;
}

/** GHS is the platform's only settlement currency. */
const CURRENCY = 'GHS';

/**
 * Paystack payment gateway (card + mobile money in GHS for Ghana). Talks to the
 * REST API over `fetch` — no SDK. When no secret key is configured the gateway
 * reports itself disabled and callers surface a 501 rather than crashing, so
 * the wallet rail keeps working with Paystack absent.
 */
export class PaystackGateway implements PaymentGatewayPort {
  private static readonly BASE_URL = 'https://api.paystack.co';

  constructor(private readonly config: PaystackGatewayConfig) {}

  isConfigured(): boolean {
    return this.config.secretKey.length > 0;
  }

  capabilities(): ProviderCapabilities {
    // Paystack: Ghana mobile money + cards; presentment in GHS plus the diaspora
    // currencies Paystack supports for eligible merchants. International-card
    // acceptance and non-GHS presentment are policy-gated by the PaymentRouter's
    // feature flags — this only describes what the provider can technically do.
    return {
      provider: 'paystack',
      countries: ['*'],
      currencies: ['GHS', 'USD', 'GBP', 'EUR', 'CAD', 'NGN', 'ZAR', 'KES'],
      methods: ['mobile_money', 'card', 'bank', 'ussd'],
      supportsInternationalCards: true,
    };
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeTransaction(
    intent: DonationIntentEntity
  ): Promise<PaymentGatewayInitResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    // Paystack requires an email; a guest who supplied none cannot proceed.
    if (!intent.donorEmail) {
      throw new AppError('An email is required to pay with Paystack', 400);
    }

    // Our own unique reference — echoed back by Paystack and stored as the
    // intent's providerRef, so the later webhook correlates deterministically.
    const reference = `uf-${intent.id}-${randomUUID().slice(0, 8)}`;
    // Charge amount + tip in the contributor's currency, as integer minor units.
    // GHS (the platform currency) behaves exactly as before; a diaspora currency
    // (USD/GBP/…) is charged in its own minor units when multi-currency is on.
    const currency = intent.currency || CURRENCY;
    const amount = toMinorUnits(intent.amount + intent.tip, currency);

    const body = {
      email: intent.donorEmail,
      amount,
      currency,
      reference,
      callback_url: `${this.config.publicWebUrl}/donate/callback`,
      metadata: {
        donationIntentId: intent.id,
        campaignId: intent.campaignId,
        liveSessionId: intent.liveSessionId,
        donorName: intent.donorName,
        isAnonymous: intent.isAnonymous,
        tip: intent.tip,
      },
    };

    const json = await this.request<PaystackInitData>(
      'POST',
      '/transaction/initialize',
      body
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack initialization failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }

    return {
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code,
      reference: json.data.reference,
    };
  }

  async initializeCharge(
    params: InitializeChargeParams
  ): Promise<PaymentGatewayInitResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    // Paystack requires an email to open a transaction.
    if (!params.email) {
      throw new AppError('An email is required to pay with Paystack', 400);
    }

    // Our own unique reference — echoed back by Paystack and stored as the
    // charge's providerRef, so the later webhook correlates deterministically.
    const reference = params.reference ?? `${params.referencePrefix}-${randomUUID().slice(0, 8)}`;
    // Charge amount, converted to pesewas (minor units).
    const amount = Math.round(params.amount * 100);

    const body = {
      email: params.email,
      amount,
      currency: CURRENCY,
      reference,
      callback_url: `${this.config.publicWebUrl}${params.callbackPath ?? '/donate/callback'}`,
      metadata: params.metadata,
    };

    const json = await this.request<PaystackInitData>(
      'POST',
      '/transaction/initialize',
      body
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack initialization failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }

    return {
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code,
      reference: json.data.reference,
    };
  }

  async verifyTransaction(
    reference: string
  ): Promise<PaymentGatewayVerifyResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }

    const json = await this.request<PaystackVerifyData>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack verification failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }

    const data = json.data;
    const currency = data.currency ?? CURRENCY;
    return {
      status: data.status,
      reference: data.reference,
      // Paystack returns amounts in integer minor units of the charged currency.
      amount: fromMinorUnits(Number(data.amount) || 0, currency),
      fees: fromMinorUnits(Number(data.fees) || 0, currency),
      currency,
      raw: data,
    };
  }

  async refundPayment(
    reference: string,
    amountMajor?: number,
    currency = CURRENCY
  ): Promise<PaymentGatewayRefundResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    // Paystack /refund correlates on the transaction reference; `amount` (minor
    // units) is optional — omit for a full refund.
    const body: Record<string, unknown> = { transaction: reference };
    if (amountMajor !== undefined) {
      body.amount = toMinorUnits(amountMajor, currency);
    }
    const json = await this.request<{ status?: string; id?: number | string }>(
      'POST',
      '/refund',
      body
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack refund failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return {
      status: json.data.status ?? 'pending',
      reference: json.data.id !== undefined ? String(json.data.id) : undefined,
      raw: json.data as Record<string, unknown>,
    };
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined
  ): boolean {
    if (!this.isConfigured() || !signature) {
      return false;
    }
    const expected = createHmac('sha512', this.config.secretKey)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signature, 'utf8');
    // timingSafeEqual throws on length mismatch — guard first.
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  // ── Payouts (Transfers) ──────────────────────────────────────────────────

  async listBanks(
    currency: string,
    type?: string
  ): Promise<PaymentGatewayBank[]> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    const params = new URLSearchParams({ currency });
    if (type) params.set('type', type);

    const json = await this.request<PaystackBankData[]>(
      'GET',
      `/bank?${params.toString()}`
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack bank listing failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return json.data.map((b) => ({
      name: b.name,
      code: b.code,
      currency: b.currency,
      type: b.type,
      active: b.active,
    }));
  }

  async createTransferRecipient(
    params: CreateTransferRecipientParams
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    const body = {
      type: params.type,
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: params.currency ?? CURRENCY,
    };
    const json = await this.request<PaystackRecipientData>(
      'POST',
      '/transferrecipient',
      body
    );
    if (!json.status || !json.data?.recipient_code) {
      throw new AppError(
        `Paystack recipient creation failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return json.data.recipient_code;
  }

  async initiateTransfer(
    params: InitiateTransferParams
  ): Promise<PaymentGatewayTransferResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    const body = {
      source: 'balance',
      // Amount to Paystack is in pesewas (minor units).
      amount: Math.round(params.amount * 100),
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason,
      currency: CURRENCY,
    };
    const json = await this.request<PaystackTransferData>(
      'POST',
      '/transfer',
      body
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack transfer failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return {
      transferCode: json.data.transfer_code,
      status: json.data.status,
      reference: json.data.reference,
      raw: json.data as Record<string, unknown>,
    };
  }

  async verifyTransfer(
    reference: string
  ): Promise<PaymentGatewayTransferResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    const json = await this.request<PaystackTransferData>(
      'GET',
      `/transfer/verify/${encodeURIComponent(reference)}`
    );
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack transfer verification failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return {
      transferCode: json.data.transfer_code,
      status: json.data.status,
      reference: json.data.reference,
      raw: json.data as Record<string, unknown>,
    };
  }

  async getBalance(): Promise<PaymentGatewayBalance[]> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    const json = await this.request<PaystackBalanceData[]>('GET', '/balance');
    if (!json.status || !json.data) {
      throw new AppError(
        `Paystack balance lookup failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return json.data.map((b) => ({
      currency: b.currency,
      // Provider reports balances in pesewas (minor units).
      balance: (Number(b.balance) || 0) / 100,
    }));
  }

  /** Issue a request to the Paystack REST API and parse its JSON envelope. */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<PaystackEnvelope<T>> {
    let res: Response;
    try {
      res = await fetch(`${PaystackGateway.BASE_URL}${path}`, {
        method,
        headers: this.authHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      logger.error({ err: error, path }, 'paystack request failed');
      throw new AppError('Payment provider is unreachable', 502);
    }

    let json: PaystackEnvelope<T>;
    try {
      json = (await res.json()) as PaystackEnvelope<T>;
    } catch (error) {
      logger.error({ err: error, path, httpStatus: res.status }, 'paystack response was not JSON');
      throw new AppError('Payment provider returned an invalid response', 502);
    }
    return json;
  }
}
