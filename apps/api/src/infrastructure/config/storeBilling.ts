import { z } from 'zod';
import { BillingCycle } from '@ubuntu-fund/types';
import { Environment } from '@apple/app-store-server-library';
import { StorePurchaseVerifier, createStoreVerifierDependencies } from '../adapters/outbound/payments/StorePurchaseVerifier.js';
import { StoreReceiptCipher } from '../adapters/outbound/payments/StoreReceiptCipher.js';
import { MongoStoreBilling } from '../adapters/outbound/persistence/MongoStoreBilling.js';

const productSchema = z.object({
  store: z.enum(['apple', 'google']), productId: z.string().min(1).max(200),
  basePlanId: z.string().min(1).max(100).optional(),
  tier: z.string().min(1).max(80).refine((v) => v !== 'free'), billingCycle: z.nativeEnum(BillingCycle),
}).strict();
const text = z.string().min(1);

/**
 * App Review and TestFlight purchase with sandbox accounts against the
 * production build, so a production deployment also accepts sandbox receipts
 * (Apple's documented production-then-sandbox fallback) unless explicitly
 * disabled. Sandbox purchases are recorded as sandbox and excluded from revenue.
 */
export function appleSandboxFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return z.enum(['true', 'false']).optional().parse(env.APPLE_IAP_ALLOW_SANDBOX_FALLBACK || undefined) !== 'false';
}
/** Explicitly disabled until the owner supplies a real catalog and store credentials. */
export function configureStoreBilling(env: NodeJS.ProcessEnv = process.env) {
  if (env.STORE_BILLING_ENABLED !== 'true') return null;
  try {
    const products = z.array(productSchema).min(1).max(100).parse(JSON.parse(text.parse(env.STORE_BILLING_PRODUCTS)));
    const identifiers = products.map((p) => `${p.store}:${p.productId}:${p.basePlanId ?? ''}`);
    const plans = products.map((p) => `${p.store}:${p.tier}:${p.billingCycle}`);
    if (new Set(identifiers).size !== identifiers.length || new Set(plans).size !== plans.length ||
        products.some((p) => p.store === 'google' ? !p.basePlanId : !!p.basePlanId)) throw new Error('Invalid catalog');
    const cipher = new StoreReceiptCipher(Buffer.from(text.parse(env.STORE_RECEIPT_ENCRYPTION_KEY_BASE64), 'base64'));
    const options: Parameters<typeof createStoreVerifierDependencies>[0] = { products };
    if (products.some((p) => p.store === 'apple')) {
      const environment = z.enum(['production', 'sandbox']).parse(env.APPLE_IAP_ENVIRONMENT);
      options.apple = {
        privateKey: Buffer.from(text.parse(env.APPLE_IAP_PRIVATE_KEY_BASE64), 'base64').toString('utf8'),
        keyId: text.parse(env.APPLE_IAP_KEY_ID), issuerId: z.string().uuid().parse(env.APPLE_IAP_ISSUER_ID),
        bundleId: text.parse(env.APPLE_IAP_BUNDLE_ID),
        environment: environment === 'production' ? Environment.PRODUCTION : Environment.SANDBOX,
        appAppleId: env.APPLE_IAP_APP_ID ? z.coerce.number().int().positive().parse(env.APPLE_IAP_APP_ID) : undefined,
        rootCertificates: z.array(text).min(1).parse(JSON.parse(text.parse(env.APPLE_IAP_ROOT_CERTIFICATES_BASE64)))
          .map((certificate) => Buffer.from(certificate, 'base64')),
        allowSandboxFallback: environment === 'production' && appleSandboxFallbackEnabled(env),
      };
    }
    if (products.some((p) => p.store === 'google')) {
      options.google = {
        credentials: z.object({ client_email: z.string().email(), private_key: text })
          .parse(JSON.parse(text.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON))),
        packageName: text.parse(env.GOOGLE_PLAY_PACKAGE_NAME),
        allowTestPurchases: env.GOOGLE_PLAY_ALLOW_TEST_PURCHASES === 'true',
        pushAudience: z.string().url().startsWith('https://').parse(env.GOOGLE_PLAY_RTDN_AUDIENCE),
        pushServiceAccount: z.string().email().parse(env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT),
      };
    }
    const verifier = new StorePurchaseVerifier(createStoreVerifierDependencies(options));
    return { products, verifier, billing: new MongoStoreBilling(verifier, cipher) };
  } catch {
    // Zod/SDK errors can embed credential inputs. Never log the original error.
    throw new Error('Store billing configuration is invalid or incomplete. Check the server-only catalog, credentials, environment and receipt-encryption key.');
  }
}

export type StoreBillingRuntime = NonNullable<ReturnType<typeof configureStoreBilling>>;
