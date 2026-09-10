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

/**
 * Params for opening a hosted checkout for any charge that has no
 * DonationIntent behind it (e.g. a subscription's first payment).
 */
export interface InitializeChargeParams {
  /** Payer's email; the provider requires it to open a transaction. */
  email: string;
  /** Amount in MAJOR currency units (GHS); the gateway converts to pesewas. */
  amount: number;
  /** Prefix for our unique transaction reference (e.g. 'sub' → 'sub_…'). */
  referencePrefix: string;
  /** Pre-persisted reference for recoverable non-donation charges. */
  reference?: string;
  /** Arbitrary payload forwarded to the provider and echoed on the webhook. */
  metadata?: Record<string, unknown>;
  /** Path appended to the configured callback base to return the payer. */
  callbackPath?: string;
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

/** A bank / mobile-money institution from the provider's directory. */
export interface PaymentGatewayBank {
  name: string;
  /** Institution code — stored as a recipient's `bankCode`. */
  code: string;
  currency?: string;
  /** 'ghipss' for banks, 'mobile_money' for telcos (when the provider tags it). */
  type?: string;
  active?: boolean;
}

/** Params for registering a payout recipient with the provider. */
export interface CreateTransferRecipientParams {
  type: 'ghipss' | 'mobile_money';
  name: string;
  /** Bank account number, or the phone number for mobile money. */
  accountNumber: string;
  /** Bank code, or the telco code for mobile money. */
  bankCode: string;
  /** Currency code; defaults to the platform currency (GHS). */
  currency?: string;
}

/** Params for initiating a transfer to a registered recipient. */
export interface InitiateTransferParams {
  /** Amount in MAJOR currency units (GHS); the gateway converts to pesewas. */
  amount: number;
  /** Provider recipient handle to pay. */
  recipientCode: string;
  /** Our unique idempotency reference; the webhook correlates on it. */
  reference: string;
  reason?: string;
}

/** Result of initiating a transfer. */
export interface PaymentGatewayTransferResult {
  /** Provider transfer handle. */
  transferCode: string;
  /** Provider status: 'pending' | 'success' | 'otp' | 'failed' | 'reversed' | … */
  status: string;
  reference: string;
  raw: Record<string, unknown>;
}

/** Result of a provider refund request. */
export interface PaymentGatewayRefundResult {
  /** Provider status for the refund ('pending' | 'processed' | 'failed' | …). */
  status: string;
  /** Provider refund reference/id, when returned. */
  reference?: string;
  raw: Record<string, unknown>;
}

/** A single-currency balance held with the provider. */
export interface PaymentGatewayBalance {
  currency: string;
  /** Balance in MAJOR currency units (GHS). */
  balance: number;
}

/** A payment method a provider can accept. */
export type PaymentMethodKind = 'mobile_money' | 'card' | 'bank' | 'ussd' | 'apple_pay' | 'google_pay';

/**
 * What a provider adapter can accept (spec §6 `capabilities()`), used by the
 * {@link PaymentRouter} to pick a rail without the campaign domain knowing any
 * provider specifics. `['*']` means "any" (e.g. a card provider that accepts
 * cards from anywhere).
 */
export interface ProviderCapabilities {
  /** Stable provider key, e.g. 'paystack' | 'flutterwave'. */
  provider: string;
  /** ISO-3166 alpha-2 country codes the provider serves, or ['*']. */
  countries: string[];
  /** ISO-4217 currencies the provider can charge, or ['*']. */
  currencies: string[];
  /** Payment methods the provider supports. */
  methods: PaymentMethodKind[];
  /** Whether the provider accepts international (non-domestic) cards. */
  supportsInternationalCards: boolean;
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
   * What this provider can accept — countries, currencies, methods (spec §6).
   * The {@link PaymentRouter} reads this to select a rail; pure/synchronous and
   * safe to call whether or not the gateway is configured.
   */
  capabilities(): ProviderCapabilities;

  /**
   * Open a hosted checkout for an intent: registers the charge with the
   * provider and returns the handoff (authorization URL / access code /
   * reference). The reference becomes the intent's providerRef.
   */
  initializeTransaction(
    intent: DonationIntentEntity
  ): Promise<PaymentGatewayInitResult>;

  /**
   * Open a hosted checkout for a charge that has no DonationIntent behind it
   * (e.g. a subscription's first payment): registers the charge from the given
   * params and returns the same handoff (authorization URL / access code /
   * reference) as {@link initializeTransaction}.
   */
  initializeCharge(
    params: InitializeChargeParams
  ): Promise<PaymentGatewayInitResult>;

  /** Server-verify a transaction by reference (callback confirmation rail). */
  verifyTransaction(reference: string): Promise<PaymentGatewayVerifyResult>;

  /**
   * Refund a settled transaction by its provider reference (spec §14). Omit
   * `amountMajor` for a full refund; pass it (in MAJOR currency units) for a
   * partial refund. Throws 501 when the provider can't refund here.
   */
  refundPayment(
    reference: string,
    amountMajor?: number,
    currency?: string
  ): Promise<PaymentGatewayRefundResult>;

  /**
   * Verify a webhook's authenticity from its raw request body and the
   * provider's signature header. Returns false for a missing/invalid signature
   * or an unconfigured gateway — never throws.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;

  // ── Payouts (Transfers) ──────────────────────────────────────────────────

  /**
   * List the banks (or, with `type: 'mobile_money'`, the mobile-money telcos)
   * available for a currency. Throws a 501 when the gateway is unconfigured.
   */
  listBanks(currency: string, type?: string): Promise<PaymentGatewayBank[]>;

  /**
   * Register a payout recipient with the provider and return its opaque
   * recipient code (addresses transfers). Throws a 501 when unconfigured.
   */
  resolveAccount?(accountNumber: string, bankCode: string): Promise<{ accountName: string }>;

  createTransferRecipient(params: CreateTransferRecipientParams): Promise<string>;

  /**
   * Initiate a transfer of cleared funds to a registered recipient. Throws a
   * 501 when unconfigured; the returned status is the provider's initial status
   * (a `transfer.*` webhook later confirms the terminal outcome).
   */
  initiateTransfer(
    params: InitiateTransferParams
  ): Promise<PaymentGatewayTransferResult>;

  /** Server-verify a transfer by its reference (the callback confirmation rail). */
  verifyTransfer(reference: string): Promise<PaymentGatewayTransferResult>;

  /** The provider's current balances (per currency). 501 when unconfigured. */
  getBalance(): Promise<PaymentGatewayBalance[]>;
}
