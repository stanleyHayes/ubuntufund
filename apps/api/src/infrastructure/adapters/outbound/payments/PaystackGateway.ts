import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DonationIntentEntity } from '../../../../domain/entities/DonationIntent.js';
import type {
  PaymentGatewayInitResult,
  PaymentGatewayPort,
  PaymentGatewayVerifyResult,
} from '../../../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { logger } from '../../../logging/logger.js';

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
    // Charge amount + tip, converted to pesewas (minor units).
    const amount = Math.round((intent.amount + intent.tip) * 100);

    const body = {
      email: intent.donorEmail,
      amount,
      currency: CURRENCY,
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
    return {
      status: data.status,
      reference: data.reference,
      amount: (Number(data.amount) || 0) / 100,
      fees: (Number(data.fees) || 0) / 100,
      currency: data.currency ?? CURRENCY,
      raw: data,
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
