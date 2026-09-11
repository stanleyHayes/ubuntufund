import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Numeric env var with a guaranteed-finite fallback.
 *
 * `envNumber(process.env.X, 50000)` looks safe but is not: `??`
 * only catches undefined, so a var present-but-blank (`PAYOUT_X=` in a .env, or
 * an empty value in a deploy dashboard) parses to NaN. NaN then propagates
 * silently — every `amount >= NaN` comparison is false, so a blank
 * PAYOUT_DUAL_APPROVAL_AMOUNT disables maker-checker approval entirely rather
 * than failing loudly.
 */
function envNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat((raw ?? '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface FeeConfig {
  /** Platform revenue cut, as a % of the campaign-directed donation amount. */
  platformFeePercent: number;
  /** Paystack percentage fee (used by the hosted-payment phase). */
  paystackFeePercent: number;
  /** Paystack flat per-transaction fee, in major currency units. */
  paystackFlatFee: number;
}

interface PaystackConfig {
  /**
   * Paystack secret key (server-only). Empty string disables the Paystack rail
   * entirely — `POST /donation-intents` with `provider: 'paystack'` then
   * returns 501, and the webhook rejects everything. The wallet rail is
   * unaffected.
   */
  secretKey: string;
  /** Paystack publishable key — safe to expose to the client. */
  publicKey: string;
}

interface AffiliateConfig {
  /** Referral commission cut, as a % of the referee's first paid subscription. */
  commissionPercent: number;
  /** Days a newly accrued commission stays 'held' before it matures to 'available'. */
  holdDays: number;
  /**
   * Discount a referee gets for entering an affiliate's referral code at
   * checkout, as a % of the plan price.
   *
   * 0 (the default) disables the behaviour entirely: an affiliate code typed
   * into the coupon box is then just an unknown coupon, exactly as before.
   * Set it above zero and one code does both jobs — the referee saves and the
   * referrer still earns.
   */
  referralDiscountPercent: number;
}

interface FlutterwaveConfig {
  /** Flutterwave secret key (server-only). Empty ⇒ the Flutterwave rail is disabled. */
  secretKey: string;
  /** Flutterwave public key — safe to expose to the client. */
  publicKey: string;
  /**
   * The `secret hash` you set in the Flutterwave dashboard; the webhook echoes
   * it in the `verif-hash` header and we compare against this. Empty ⇒ the
   * Flutterwave webhook rejects everything.
   */
  webhookHash: string;
}

/**
 * Multi-rail payments feature flags + provider policy (spec §16). Everything
 * defaults OFF so the working Ghana MoMo (Paystack) path is unchanged until a
 * rail/currency is explicitly enabled; each flag is independently reversible.
 */
export interface PaymentsConfig {
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
  /** Gate for Paystack international card acceptance (needs merchant eligibility). */
  internationalCardsEnabled: boolean;
  /** Gate for accepting/presenting non-GHS contribution currencies. */
  multiCurrencyEnabled: boolean;
  /** Provider chosen when routing has no more specific rule. */
  defaultProvider: string;
  /** Whether the scheduled reconciliation job runs. */
  reconciliationEnabled: boolean;
  /** Currencies the checkout may present when multi-currency is enabled. */
  supportedCurrencies: string[];
  /** Optional static FX source label recorded on contributions (e.g. 'provider', 'manual'). */
  fxSource: string;
}

/** Campaign risk-tiering + review policy (spec §4). Admin-configurable. */
export interface CampaignsConfig {
  /**
   * Ascending goal boundaries that split campaigns into tiers 1–5. A goal is in
   * tier `1 + (number of thresholds it exceeds)`. Default (GHS): 10k/50k/250k/1M
   * → Tier 1 ≤10k, 2 ≤50k, 3 ≤250k, 4 ≤1M, 5 >1M.
   */
  tierThresholds: number[];
  /**
   * The highest tier that is auto-approved (goes live immediately). Campaigns
   * above this tier are held in PENDING_REVIEW for manual compliance review.
   * Default 2 (Tiers 1–2 automated; 3+ manual), per the v6 tier table.
   */
  autoApproveMaxTier: number;
}

/** Payout service fees + reserve policy (spec §17). Admin-configurable. */
export interface PayoutsConfig {
  /** Priority payout: `percent`% of the amount, at least `minFee` GHS. */
  priorityFeePercent: number;
  priorityMinFee: number;
  /** Early payout (before campaign end). */
  earlyFeePercent: number;
  earlyMinFee: number;
  /** Urgent early payout. */
  urgentFeePercent: number;
  urgentMinFee: number;
  /** Assisted bank payout: `percent`% + a fixed service charge. */
  assistedFeePercent: number;
  assistedFixedFee: number;
  /** Max % of the eligible balance an early/urgent payout may withdraw (reserve = 100 − this). */
  earlyMaxWithdrawalPercent: number;
  /** Provider single-transfer ceiling (GHS); larger payouts must be batched. */
  maxTransferAmount: number;
  /**
   * Maker-checker threshold (GHS): a payout whose gross amount is at least this
   * needs two distinct admin approvals before its transfer initiates. `0`
   * disables dual approval (single approval for every payout).
   */
  dualApprovalAmount: number;
}

export interface AppConfig {
  aiWriting: { enabled: boolean; apiKey: string; model: string; dailyLimit: number; globalDailyLimit: number };
  liveVideo: { url: string; apiKey: string; apiSecret: string };
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  nodeEnv: string;
  corsOrigins: string[];
  cloudinary: CloudinaryConfig;
  /** Donation fee policy (platform + processor fees). */
  fees: FeeConfig;
  /** Paystack credentials (Ghana card + mobile money in GHS). */
  paystack: PaystackConfig;
  /** Flutterwave credentials (secondary/alternative rail; disabled until keyed). */
  flutterwave: FlutterwaveConfig;
  /** Multi-rail payments feature flags + provider policy. */
  payments: PaymentsConfig;
  /** Referral/affiliate commission policy (rate + hold window). */
  affiliate: AffiliateConfig;
  /** Campaign risk-tiering + review thresholds (spec §4). */
  campaigns: CampaignsConfig;
  /** Payout service fees + reserve policy (spec §17). */
  payouts: PayoutsConfig;
  /**
   * Split-proceeds multi-beneficiary accrual + per-beneficiary payouts (spec §17
   * split). Default OFF: the economic-expectation model needs Ghana legal
   * sign-off (plan §6) before it may be enabled in production.
   */
  splitProceedsEnabled: boolean;
  /** Crypto donation rail (Crypto Donations plan). Default OFF: needs provider
   * onboarding + Ghana legal/compliance sign-off (§16) before production. */
  crypto: CryptoConfig;
  /** Public base URL of the donor-facing web app; builds `/c/:slug` targets & canonical URLs. */
  publicWebUrl: string;
  /** Public base URL this API is reachable at; builds short URLs (`/r/:code`). */
  publicApiUrl: string;
}

/** Crypto donation rail configuration (Crypto Donations plan §23). */
export interface CryptoConfig {
  /** Master switch — crypto donations are rejected unless true (§22). */
  enabled: boolean;
  /** Which provider adapter handles crypto (default the built-in sandbox). */
  primaryProvider: string;
  /** Server-side asset allowlist; the frontend never dictates supported assets. */
  allowedAssets: string[];
  /** Min/max GHS-equivalent per crypto contribution. */
  minGhs: number;
  maxGhs: number;
  /** How long a quote stays valid before a deposit against it is rejected (§9). */
  quoteTtlSeconds: number;
  /** HMAC secret the built-in sandbox provider signs/verifies webhooks with. */
  mockWebhookSecret: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = requireEnv('JWT_SECRET');
const jwtRefreshSecret = requireEnv('JWT_REFRESH_SECRET');

if (nodeEnv === 'production') {
  if (jwtSecret.length < 32 || jwtRefreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be distinct in production');
  }
}

const defaultDevOrigins = [
  'http://localhost:8200',
  'http://localhost:8300',
  'http://localhost:8400',
  'http://localhost:18200',
  // Expo (mobile) dev origins: metro web preview + dev server ports
  'http://localhost:8081',
  'http://localhost:8600',
  'http://localhost:19006',
];

function aiLimit(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 100000) throw new Error(`${name} must be an integer between 1 and 100000`);
  return value;
}
export const config: AppConfig = {
  aiWriting: { enabled: process.env.AI_WRITING_ENABLED === 'true', apiKey: process.env.OPENAI_API_KEY ?? '', model: process.env.AI_WRITING_MODEL ?? 'gpt-4.1-mini', dailyLimit: aiLimit('AI_WRITING_DAILY_LIMIT', 20), globalDailyLimit: aiLimit('AI_WRITING_GLOBAL_DAILY_LIMIT', 500) },
  liveVideo: { url: process.env.LIVEKIT_URL ?? '', apiKey: process.env.LIVEKIT_API_KEY ?? '', apiSecret: process.env.LIVEKIT_API_SECRET ?? '' },
  port: envNumber(process.env.PORT, 4000),
  mongodbUri: requireEnv('MONGODB_URI'),
  jwtSecret,
  jwtRefreshSecret,
  nodeEnv,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : nodeEnv === 'development'
      ? defaultDevOrigins
      : [],
  // Cloudinary is optional groundwork: absent creds simply disable signed
  // uploads (the endpoint returns 501) rather than blocking boot.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  // Fees default to zero so beneficiary-net equals the donation amount unless
  // configured. The Paystack rail (Phase 4) supplies the processor's real fee
  // at settlement time regardless of these preview defaults.
  fees: {
    platformFeePercent: envNumber(process.env.PLATFORM_FEE_PERCENT, 0),
    paystackFeePercent: envNumber(process.env.PAYSTACK_FEE_PERCENT, 0),
    paystackFlatFee: envNumber(process.env.PAYSTACK_FLAT_FEE, 0),
  },
  // Absent secret key ⇒ the Paystack rail is disabled (501), the wallet rail
  // keeps working. The secret key is server-only; never expose it to clients.
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
  },
  // Absent secret key ⇒ the Flutterwave rail is disabled; the webhook rejects
  // everything until the dashboard secret hash is configured too.
  flutterwave: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ?? '',
    webhookHash: process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH ?? '',
  },
  // Multi-rail flags default OFF so the Ghana MoMo path is unchanged until a
  // rail/currency is explicitly enabled (spec §16).
  payments: {
    paystackEnabled: (process.env.PAYMENTS_PAYSTACK_ENABLED ?? 'true') !== 'false',
    flutterwaveEnabled: process.env.PAYMENTS_FLUTTERWAVE_ENABLED === 'true',
    internationalCardsEnabled: process.env.PAYMENTS_INTERNATIONAL_CARDS_ENABLED === 'true',
    multiCurrencyEnabled: process.env.PAYMENTS_MULTI_CURRENCY_ENABLED === 'true',
    defaultProvider: process.env.PAYMENTS_DEFAULT_PROVIDER ?? 'paystack',
    reconciliationEnabled: (process.env.PAYMENTS_RECONCILIATION_ENABLED ?? 'true') !== 'false',
    supportedCurrencies: (process.env.PAYMENTS_SUPPORTED_CURRENCIES ?? 'GHS,USD,GBP,EUR,CAD')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    fxSource: process.env.PAYMENTS_FX_SOURCE ?? 'provider',
  },
  // Affiliate commission is one-time on the referee's first paid subscription;
  // it accrues 'held' for `holdDays` before maturing to 'available'.
  affiliate: {
    commissionPercent: envNumber(process.env.AFFILIATE_COMMISSION_PERCENT, 10),
    holdDays: envNumber(process.env.AFFILIATE_HOLD_DAYS, 14),
    // Off by default: enabling a discount on every referral is a pricing
    // decision, not something a deploy should start doing on its own.
    referralDiscountPercent: envNumber(
      process.env.AFFILIATE_REFERRAL_DISCOUNT_PERCENT,
      0
    ),
  },
  campaigns: {
    // GHS goal boundaries for tiers 1–5; override with CAMPAIGN_TIER_THRESHOLDS
    // (comma-separated, ascending).
    tierThresholds: (process.env.CAMPAIGN_TIER_THRESHOLDS ?? '10000,50000,250000,1000000')
      .split(',')
      .map((v) => Number.parseFloat(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b),
    autoApproveMaxTier: envNumber(process.env.CAMPAIGN_AUTO_APPROVE_MAX_TIER, 2),
  },
  payouts: {
    priorityFeePercent: envNumber(process.env.PAYOUT_PRIORITY_FEE_PERCENT, 0.5),
    priorityMinFee: envNumber(process.env.PAYOUT_PRIORITY_MIN_FEE, 10),
    earlyFeePercent: envNumber(process.env.PAYOUT_EARLY_FEE_PERCENT, 1.0),
    earlyMinFee: envNumber(process.env.PAYOUT_EARLY_MIN_FEE, 20),
    urgentFeePercent: envNumber(process.env.PAYOUT_URGENT_FEE_PERCENT, 1.5),
    urgentMinFee: envNumber(process.env.PAYOUT_URGENT_MIN_FEE, 30),
    assistedFeePercent: envNumber(process.env.PAYOUT_ASSISTED_FEE_PERCENT, 1.5),
    assistedFixedFee: envNumber(process.env.PAYOUT_ASSISTED_FIXED_FEE, 50),
    earlyMaxWithdrawalPercent: envNumber(process.env.PAYOUT_EARLY_MAX_WITHDRAWAL_PERCENT, 80),
    maxTransferAmount: envNumber(process.env.PAYOUT_MAX_TRANSFER_AMOUNT, 50000),
    dualApprovalAmount: envNumber(process.env.PAYOUT_DUAL_APPROVAL_AMOUNT, 0),
  },
  splitProceedsEnabled: process.env.SPLIT_PROCEEDS_ENABLED === 'true',
  // Crypto rail defaults OFF (§22/§23). The sandbox `mock` provider is the
  // default so dev/tests exercise the full flow without an external account.
  crypto: {
    enabled: process.env.CRYPTO_PAYMENTS_ENABLED === 'true',
    primaryProvider: process.env.CRYPTO_PRIMARY_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'bitnob' : 'mock'),
    allowedAssets: (process.env.CRYPTO_ALLOWED_ASSETS ?? 'USDT,USDC')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    minGhs: envNumber(process.env.CRYPTO_MIN_GHS, 10),
    maxGhs: envNumber(process.env.CRYPTO_MAX_GHS, 100000),
    quoteTtlSeconds: envNumber(process.env.CRYPTO_QUOTE_TTL_SECONDS, 900),
    mockWebhookSecret:
      process.env.CRYPTO_MOCK_WEBHOOK_SECRET ?? 'mock-crypto-webhook-secret-dev',
  },
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:18200',
  publicApiUrl:
    process.env.PUBLIC_API_URL ??
    `http://localhost:${envNumber(process.env.PORT, 4000)}`,
};
