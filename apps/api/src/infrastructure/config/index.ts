import * as dotenv from 'dotenv';

dotenv.config();

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface FeeConfig {
  /** Platform revenue cut, as a % of the campaign-directed donation amount. */
  platformFeePercent: number;
  /** Paystack percentage fee (used by the hosted-payment phase). */
  paystackFeePercent: number;
  /** Paystack flat per-transaction fee, in major currency units. */
  paystackFlatFee: number;
}

export interface PaystackConfig {
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

export interface AppConfig {
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
  /** Public base URL of the donor-facing web app; builds `/c/:slug` targets & canonical URLs. */
  publicWebUrl: string;
  /** Public base URL this API is reachable at; builds short URLs (`/r/:code`). */
  publicApiUrl: string;
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

export const config: AppConfig = {
  port: parseInt(process.env.PORT ?? '4000', 10),
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
    platformFeePercent: Number.parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '0'),
    paystackFeePercent: Number.parseFloat(process.env.PAYSTACK_FEE_PERCENT ?? '0'),
    paystackFlatFee: Number.parseFloat(process.env.PAYSTACK_FLAT_FEE ?? '0'),
  },
  // Absent secret key ⇒ the Paystack rail is disabled (501), the wallet rail
  // keeps working. The secret key is server-only; never expose it to clients.
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
  },
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:18200',
  publicApiUrl:
    process.env.PUBLIC_API_URL ??
    `http://localhost:${parseInt(process.env.PORT ?? '4000', 10)}`,
};
