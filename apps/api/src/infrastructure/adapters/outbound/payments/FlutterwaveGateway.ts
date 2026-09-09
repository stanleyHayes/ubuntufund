import { randomUUID, timingSafeEqual } from 'node:crypto';
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

export interface FlutterwaveGatewayConfig {
  /** Server-only secret key. Empty ⇒ the gateway is disabled. */
  secretKey: string;
  publicKey: string;
  /** Dashboard "secret hash"; the webhook echoes it in the `verif-hash` header. */
  webhookHash: string;
  /** Donor-facing web app base URL; builds the checkout redirect target. */
  publicWebUrl: string;
}

/** Flutterwave v3 `{ status, message, data }` envelope. */
interface FlwEnvelope<T> {
  status?: string; // 'success' | 'error'
  message?: string;
  data?: T;
}

interface FlwPaymentLinkData {
  link: string;
}

interface FlwTransactionData {
  id: number;
  tx_ref: string;
  status: string; // 'successful' | 'failed' | 'pending'
  amount: number; // MAJOR units
  currency: string;
  app_fee?: number;
  [key: string]: unknown;
}

/**
 * Flutterwave payment gateway (secondary/alternative diaspora-card rail). Talks
 * to the Flutterwave v3 REST API over `fetch` — no SDK. Disabled (isConfigured
 * → false) until a secret key is present, so it's inert behind its feature flag
 * until credentials are supplied.
 *
 * NOTE (spec §24.7): the endpoints + the `verif-hash` webhook scheme below
 * follow Flutterwave's documented v3 API. Confirm them against the current
 * Flutterwave docs and run the sandbox smoke tests before enabling in
 * production. Payout/Transfer methods are intentionally not wired here — payouts
 * remain on the existing Paystack rail — so they surface a clear 501.
 */
export class FlutterwaveGateway implements PaymentGatewayPort {
  private static readonly BASE_URL = 'https://api.flutterwave.com/v3';

  constructor(private readonly config: FlutterwaveGatewayConfig) {}

  isConfigured(): boolean {
    return this.config.secretKey.length > 0;
  }

  capabilities(): ProviderCapabilities {
    return {
      provider: 'flutterwave',
      countries: ['*'],
      currencies: ['GHS', 'USD', 'GBP', 'EUR', 'NGN', 'KES', 'ZAR'],
      methods: ['card', 'bank', 'mobile_money'],
      supportsInternationalCards: true,
    };
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<FlwEnvelope<T>> {
    const res = await fetch(`${FlutterwaveGateway.BASE_URL}${path}`, {
      method,
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as FlwEnvelope<T>;
    if (!res.ok) {
      throw new AppError(
        `Flutterwave request failed (${res.status}): ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return json;
  }

  async initializeTransaction(
    intent: DonationIntentEntity
  ): Promise<PaymentGatewayInitResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    if (!intent.donorEmail) {
      throw new AppError('An email is required to pay with Flutterwave', 400);
    }
    // Our own unique reference — echoed back by Flutterwave (tx_ref) and stored
    // as the intent's providerRef, so the later webhook correlates.
    const reference = `uf-${intent.id}-${randomUUID().slice(0, 8)}`;
    const body = {
      tx_ref: reference,
      // Flutterwave's /payments takes the amount in MAJOR units.
      amount: intent.amount + intent.tip,
      currency: intent.currency,
      redirect_url: `${this.config.publicWebUrl}/donate/callback`,
      customer: {
        email: intent.donorEmail,
        name: intent.donorName,
      },
      meta: {
        donationIntentId: intent.id,
        campaignId: intent.campaignId,
        liveSessionId: intent.liveSessionId,
        isAnonymous: intent.isAnonymous,
        tip: intent.tip,
      },
    };
    const json = await this.request<FlwPaymentLinkData>('POST', '/payments', body);
    if (json.status !== 'success' || !json.data?.link) {
      throw new AppError(
        `Flutterwave initialization failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return {
      authorizationUrl: json.data.link,
      // Flutterwave has no client-side access code equivalent; the hosted link
      // is the handoff.
      accessCode: '',
      reference,
    };
  }

  async initializeCharge(
    params: InitializeChargeParams
  ): Promise<PaymentGatewayInitResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    if (!params.email) {
      throw new AppError('An email is required to pay with Flutterwave', 400);
    }
    const reference = params.reference ?? `${params.referencePrefix}-${randomUUID().slice(0, 8)}`;
    const body = {
      tx_ref: reference,
      amount: params.amount,
      currency: 'GHS',
      redirect_url: `${this.config.publicWebUrl}${params.callbackPath ?? '/donate/callback'}`,
      customer: { email: params.email },
      meta: params.metadata,
    };
    const json = await this.request<FlwPaymentLinkData>('POST', '/payments', body);
    if (json.status !== 'success' || !json.data?.link) {
      throw new AppError(
        `Flutterwave initialization failed: ${json.message ?? 'unknown error'}`,
        502
      );
    }
    return { authorizationUrl: json.data.link, accessCode: '', reference };
  }

  async verifyTransaction(reference: string): Promise<PaymentGatewayVerifyResult> {
    if (!this.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    const json = await this.request<FlwTransactionData>(
      'GET',
      `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`
    );
    const data = json.data;
    if (!data) {
      throw new AppError('Flutterwave verification returned no data', 502);
    }
    return {
      // Normalize FLW's 'successful' to Paystack-style 'success' so the shared
      // settlement path reads one vocabulary.
      status: data.status === 'successful' ? 'success' : data.status,
      reference: data.tx_ref,
      amount: data.amount,
      fees: data.app_fee ?? 0,
      currency: data.currency,
      raw: data as Record<string, unknown>,
    };
  }

  /**
   * Flutterwave authenticates webhooks with a plain `verif-hash` header equal to
   * the dashboard "secret hash" (NOT an HMAC of the body). We compare it against
   * the configured hash in constant time. `rawBody` is unused but kept to match
   * the port. Returns false when unconfigured or the hash is absent/mismatched.
   */
  verifyWebhookSignature(_rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.isConfigured() || !this.config.webhookHash || !signature) {
      return false;
    }
    const expected = Buffer.from(this.config.webhookHash);
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length) return false;
    try {
      return timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  async refundPayment(): Promise<PaymentGatewayRefundResult> {
    // Flutterwave refunds correlate on the FLW transaction id (not our tx_ref)
    // and need live credentials; not wired here yet. Refund a Flutterwave
    // contribution from the Flutterwave dashboard until this is implemented.
    throw new AppError('Flutterwave refunds are not enabled', 501);
  }

  // ── Payouts (Transfers) — not wired for Flutterwave; payouts stay on Paystack.
  async listBanks(): Promise<PaymentGatewayBank[]> {
    throw new AppError('Flutterwave payouts are not enabled', 501);
  }
  async createTransferRecipient(_params: CreateTransferRecipientParams): Promise<string> {
    throw new AppError('Flutterwave payouts are not enabled', 501);
  }
  async initiateTransfer(
    _params: InitiateTransferParams
  ): Promise<PaymentGatewayTransferResult> {
    throw new AppError('Flutterwave payouts are not enabled', 501);
  }
  async verifyTransfer(_reference: string): Promise<PaymentGatewayTransferResult> {
    throw new AppError('Flutterwave payouts are not enabled', 501);
  }
  async getBalance(): Promise<PaymentGatewayBalance[]> {
    throw new AppError('Flutterwave payouts are not enabled', 501);
  }

  /** Log a security-relevant event without leaking secrets. */
  logSecurityEvent(message: string, meta: Record<string, unknown>): void {
    logger.warn(meta, message);
  }
}
