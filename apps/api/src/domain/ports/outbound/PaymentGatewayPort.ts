import type { DonationIntentEntity } from '../../entities/DonationIntent.js';

/** Hosted-checkout handoff returned by initializing a transaction. */
export interface PaymentGatewayInitResult {
  /** Provider-hosted payment page the donor is redirected to. */
  authorizationUrl: string;
  /** Access code for client-side (inline) checkout. */
  accessCode: string;
  /** Our unique transaction reference; stored as the intent's providerRef. */
  reference: string;
}

/** Server-side verification of a transaction (the callback rail). */
export interface PaymentGatewayVerifyResult {
  /** Provider status string (e.g. Paystack's 'success' / 'failed'). */
  status: string;
  reference: string;
  /** Total charged, in major currency units (amount + tip). */
  amount: number;
  /** Processor fee, in major currency units. */
  fees: number;
  currency: string;
  /** Raw provider payload, retained for audit. */
  raw: Record<string, unknown>;
}

/**
 * A swappable payment gateway (Paystack today). Kept behind this outbound port
 * so the donation-intent + webhook use-cases never depend on a concrete
 * provider or its HTTP shape.
 */
export interface PaymentGatewayPort {
  /** True once the gateway has the credentials it needs to operate. */
  isConfigured(): boolean;

  /**
   * Open a hosted checkout for an intent: registers the charge with the
   * provider and returns the handoff (authorization URL / access code /
   * reference). The reference becomes the intent's providerRef.
   */
  initializeTransaction(
    intent: DonationIntentEntity
  ): Promise<PaymentGatewayInitResult>;

  /** Server-verify a transaction by reference (callback confirmation rail). */
  verifyTransaction(reference: string): Promise<PaymentGatewayVerifyResult>;

  /**
   * Verify a webhook's authenticity from its raw request body and the
   * provider's signature header. Returns false for a missing/invalid signature
   * or an unconfigured gateway — never throws.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
}
