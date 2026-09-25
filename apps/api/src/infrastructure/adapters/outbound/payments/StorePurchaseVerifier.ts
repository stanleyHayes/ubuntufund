import {
  APIError,
  APIException,
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  Status,
  Type,
  VerificationException,
  VerificationStatus,
} from '@apple/app-store-server-library';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import type {
  BillingStore, StoreProduct, StorePurchaseVerifierPort, VerifiedStorePurchase,
} from '../../../../domain/ports/outbound/StorePurchaseVerifierPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

type AppleClient = Pick<AppStoreServerAPIClient, 'getTransactionInfo' | 'getAllSubscriptionStatuses'>;
type AppleVerifier = Pick<SignedDataVerifier,
  'verifyAndDecodeTransaction' | 'verifyAndDecodeRenewalInfo' | 'verifyAndDecodeNotification'>;
interface ApplePair { client: AppleClient; verifier: AppleVerifier }

export interface StoreVerifierDependencies {
  products: StoreProduct[];
  apple?: ApplePair & {
    bundleId: string; environment: Environment;
    /**
     * Sandbox client/verifier for a PRODUCTION deployment. App Review and
     * TestFlight buy with sandbox accounts against the production build, so
     * Apple's documented order is: verify in production, and only when
     * production says the transaction does not exist, retry in sandbox.
     * Absent, sandbox purchases are rejected.
     */
    sandbox?: ApplePair;
  };
  google?: {
    packageName: string;
    allowTestPurchases: boolean;
    get: (path: string) => Promise<unknown>;
    post: (path: string, body: object) => Promise<unknown>;
    pushAudience: string;
    pushServiceAccount: string;
    verifyPushToken: (token: string, audience: string) => Promise<{
      email?: string; email_verified?: boolean; iss?: string;
    } | undefined>;
  };
  now?: () => Date;
}

const googlePurchaseSchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  subscriptionState: z.string(),
  acknowledgementState: z.enum(['ACKNOWLEDGEMENT_STATE_PENDING', 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED']),
  externalAccountIdentifiers: z.object({ obfuscatedExternalAccountId: z.string().min(1).max(64) }),
  linkedPurchaseToken: z.string().min(1).optional(),
  testPurchase: z.object({}).optional(),
  lineItems: z.array(z.object({
    productId: z.string().min(1),
    expiryTime: z.string().datetime({ offset: true }),
    offerDetails: z.object({ basePlanId: z.string().min(1) }),
    autoRenewingPlan: z.object({ autoRenewEnabled: z.boolean() }).optional(),
    latestSuccessfulOrderId: z.string().optional(),
  })).min(1).max(20),
});

const invalid = () => new AppError('The store could not verify this subscription.', 422);
/** Production's definitive "no such transaction" — what a sandbox receipt gets there. */
const transactionNotFound = (error: unknown) => error instanceof APIException &&
  (error.apiError === APIError.TRANSACTION_ID_NOT_FOUND || error.apiError === APIError.ORIGINAL_TRANSACTION_ID_NOT_FOUND);
/** What a production verifier says about correctly signed sandbox data. */
const wrongEnvironment = (error: unknown) => error instanceof VerificationException &&
  (error.status === VerificationStatus.INVALID_ENVIRONMENT || error.status === VerificationStatus.INVALID_APP_IDENTIFIER);
const timestamp = (value: number | undefined): Date => {
  if (value === undefined || !Number.isFinite(value) || value <= 0 || Number.isNaN(new Date(value).getTime())) throw invalid();
  return new Date(value);
};

/** The caller owns account matching, durable unique claims, and entitlement updates. */
export class StorePurchaseVerifier implements StorePurchaseVerifierPort {
  private readonly now: () => Date;
  constructor(private readonly deps: StoreVerifierDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  private product(store: BillingStore, productId: string, basePlanId?: string): StoreProduct {
    const matches = this.deps.products.filter((p) => p.store === store && p.productId === productId &&
      (store === 'apple' || p.basePlanId === basePlanId));
    if (matches.length !== 1) throw new AppError('This store product is not available.', 422);
    return matches[0];
  }

  async verify(store: BillingStore, reference: string): Promise<VerifiedStorePurchase> {
    if (!reference || reference.length > 4096) throw invalid();
    try {
      return store === 'apple' ? await this.verifyApple(reference) : await this.verifyGoogle(reference);
    } catch (error) {
      // SDK/Gaxios errors may contain a private key, Authorization header or
      // purchase token in request config. Do not send them to the HTTP logger.
      if (error instanceof AppError) throw error;
      throw new AppError('Store verification is temporarily unavailable. Retry or restore your purchase.', 503);
    }
  }

  private async verifyApple(reference: string): Promise<VerifiedStorePurchase> {
    const apple = this.deps.apple;
    if (!apple) throw new AppError('App Store billing is not configured.', 503);
    if (!/^\d{1,40}$/.test(reference)) throw invalid();
    const sandbox = apple.environment === Environment.PRODUCTION ? apple.sandbox : undefined;
    try {
      return await this.verifyAppleIn(apple, apple.environment, reference);
    } catch (error) {
      if (!transactionNotFound(error)) throw error;
    }
    // Production has never seen this transaction. With no sandbox fallback
    // that is a definitive rejection, not a provider outage.
    if (!sandbox) throw invalid();
    // App Review / TestFlight: the same checks, against the sandbox environment,
    // and the result is marked sandbox so it is never counted as revenue.
    try {
      return await this.verifyAppleIn(sandbox, Environment.SANDBOX, reference);
    } catch (error) {
      if (transactionNotFound(error)) throw invalid();
      throw error;
    }
  }

  private async verifyAppleIn(pair: ApplePair, environment: Environment, reference: string): Promise<VerifiedStorePurchase> {
    const apple = { ...pair, bundleId: this.deps.apple!.bundleId, environment };
    const lookup = await apple.client.getTransactionInfo(reference);
    if (!lookup.signedTransactionInfo) throw invalid();
    const requested = await apple.verifier.verifyAndDecodeTransaction(lookup.signedTransactionInfo);
    if (requested.transactionId !== reference || !requested.originalTransactionId) throw invalid();
    // An old receipt is only a lookup key. Fetch current status to prevent a
    // replay of a pre-refund or pre-upgrade transaction from restoring access.
    const current = await apple.client.getAllSubscriptionStatuses(requested.originalTransactionId);
    if (current.bundleId !== apple.bundleId || current.environment !== apple.environment) throw invalid();
    const matches = current.data?.flatMap((group) => group.lastTransactions ?? [])
      .filter((item) => item.originalTransactionId === requested.originalTransactionId) ?? [];
    if (matches.length !== 1) throw invalid();
    const item = matches[0];
    if (!item.signedTransactionInfo || !item.signedRenewalInfo) throw invalid();
    const [transaction, renewal] = await Promise.all([
      apple.verifier.verifyAndDecodeTransaction(item.signedTransactionInfo),
      apple.verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo),
    ]);
    if (transaction.bundleId !== apple.bundleId || transaction.environment !== apple.environment ||
        renewal.environment !== apple.environment || transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION ||
        transaction.originalTransactionId !== requested.originalTransactionId ||
        renewal.originalTransactionId !== transaction.originalTransactionId ||
        !transaction.transactionId || !transaction.productId ||
        !transaction.appAccountToken || !z.string().uuid().safeParse(transaction.appAccountToken).success ||
        transaction.inAppOwnershipType !== 'PURCHASED') throw invalid();
    if (requested.appAccountToken?.toLowerCase() !== transaction.appAccountToken.toLowerCase()) throw invalid();
    const product = this.product('apple', transaction.productId);
    const verifiedAt = this.now();
    const periodStart = timestamp(transaction.purchaseDate);
    const periodEnd = timestamp(item.status === Status.BILLING_GRACE_PERIOD
      ? renewal.gracePeriodExpiresDate : transaction.expiresDate);
    if (periodStart > verifiedAt || periodEnd <= periodStart) throw invalid();
    return {
      ...product,
      reference: transaction.originalTransactionId,
      transactionId: transaction.transactionId,
      accountToken: transaction.appAccountToken.toLowerCase(),
      periodStart, periodEnd, verifiedAt,
      active: (item.status === Status.ACTIVE || item.status === Status.BILLING_GRACE_PERIOD) &&
        !transaction.revocationDate && !transaction.isUpgraded && periodEnd > verifiedAt,
      autoRenew: renewal.autoRenewStatus === 1,
      environment: apple.environment === Environment.PRODUCTION ? 'production' : 'sandbox',
      needsAcknowledgement: false,
      pending: false,
    };
  }

  private async verifyGoogle(reference: string): Promise<VerifiedStorePurchase> {
    const google = this.deps.google;
    if (!google) throw new AppError('Google Play billing is not configured.', 503);
    const result = googlePurchaseSchema.safeParse(await google.get(
      `purchases/subscriptionsv2/tokens/${encodeURIComponent(reference)}`));
    if (!result.success) throw invalid();
    const purchase = result.data;
    if (purchase.testPurchase && !google.allowTestPurchases) throw invalid();
    // This catalog supports one auto-renewing base plan per purchase. Reject
    // bundles/prepaid/add-ons until their distinct entitlement rules exist.
    if (purchase.lineItems.length !== 1) throw invalid();
    const line = purchase.lineItems[0];
    if (!line.autoRenewingPlan) throw invalid();
    const product = this.product('google', line.productId, line.offerDetails.basePlanId);
    const verifiedAt = this.now();
    const periodStart = timestamp(Date.parse(purchase.startTime));
    const periodEnd = timestamp(Date.parse(line.expiryTime));
    if (periodStart > verifiedAt || periodEnd <= periodStart) throw invalid();
    return {
      ...product, reference,
      transactionId: line.latestSuccessfulOrderId ?? reference,
      accountToken: purchase.externalAccountIdentifiers.obfuscatedExternalAccountId,
      periodStart, periodEnd, verifiedAt,
      active: ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']
        .includes(purchase.subscriptionState) && periodEnd > verifiedAt,
      autoRenew: line.autoRenewingPlan.autoRenewEnabled,
      environment: purchase.testPurchase ? 'sandbox' : 'production',
      needsAcknowledgement: purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
      pending: ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'].includes(purchase.subscriptionState),
      linkedReference: purchase.linkedPurchaseToken,
    };
  }

  async acknowledge(purchase: VerifiedStorePurchase): Promise<void> {
    if (purchase.store !== 'google' || !purchase.active || !purchase.needsAcknowledgement) return;
    if (!this.deps.google) throw new AppError('Google Play billing is not configured.', 503);
    try {
      await this.deps.google.post(`purchases/subscriptions/${encodeURIComponent(purchase.productId)}` +
        `/tokens/${encodeURIComponent(purchase.reference)}:acknowledge`, {});
    } catch {
      throw new AppError('The store acknowledgement needs a retry.', 503);
    }
  }

  async appleNotification(signedPayload: string): Promise<string | null> {
    const apple = this.deps.apple;
    if (!apple) throw new AppError('App Store billing is not configured.', 503);
    try {
      let pair: ApplePair = apple;
      let environment = apple.environment;
      let event;
      try {
        event = await apple.verifier.verifyAndDecodeNotification(signedPayload);
      } catch (error) {
        // A sandbox (App Review / TestFlight) notification fails the production
        // verifier's environment checks. Only then, and only when the fallback
        // is enabled, verify it in full with the sandbox verifier.
        if (!apple.sandbox || apple.environment !== Environment.PRODUCTION || !wrongEnvironment(error)) throw error;
        pair = apple.sandbox;
        environment = Environment.SANDBOX;
        event = await pair.verifier.verifyAndDecodeNotification(signedPayload);
      }
      if (event.notificationType === 'TEST') return null;
      if (!event.data?.signedTransactionInfo || event.data.bundleId !== apple.bundleId ||
          event.data.environment !== environment) throw invalid();
      // The caller re-verifies through verify(), which applies the same
      // production-then-sandbox order and records the environment.
      const transaction = await pair.verifier.verifyAndDecodeTransaction(event.data.signedTransactionInfo);
      if (!transaction.transactionId) throw invalid();
      // Caller re-fetches authoritative status; notification ordering grants nothing.
      return transaction.transactionId;
    } catch { throw new AppError('Invalid App Store notification.', 401); }
  }

  async googleNotification(authorization: string, envelope: unknown): Promise<string | null> {
    const google = this.deps.google;
    if (!google?.pushAudience || !google.pushServiceAccount) throw new AppError('Play notifications are not configured.', 503);
    try {
      if (!authorization.startsWith('Bearer ')) throw invalid();
      const claims = await google.verifyPushToken(authorization.slice(7), google.pushAudience);
      if (!claims?.email_verified || claims.email !== google.pushServiceAccount ||
          !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss ?? '')) throw invalid();
      const body = z.object({ message: z.object({ data: z.string().min(1).max(65536) }) }).parse(envelope);
      const event = z.object({
        packageName: z.literal(google.packageName),
        testNotification: z.object({}).optional(),
        subscriptionNotification: z.object({ purchaseToken: z.string().min(1).max(4096) }).optional(),
        voidedPurchaseNotification: z.object({ purchaseToken: z.string().min(1).max(4096) }).optional(),
      }).parse(JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8')));
      if (event.testNotification) return null;
      const token = event.subscriptionNotification?.purchaseToken ?? event.voidedPurchaseNotification?.purchaseToken;
      if (!token) throw invalid();
      return token;
    } catch { throw new AppError('Invalid Google Play notification.', 401); }
  }
}

/** Credentials and root certificates are server-only deployment inputs. */
export function createStoreVerifierDependencies(options: {
  products: StoreProduct[];
  apple?: { privateKey: string; keyId: string; issuerId: string; bundleId: string;
    environment: Environment.PRODUCTION | Environment.SANDBOX; rootCertificates: Buffer[]; appAppleId?: number;
    /** Production only: also accept App Review / TestFlight sandbox purchases, recorded as sandbox. */
    allowSandboxFallback?: boolean };
  google?: { packageName: string; allowTestPurchases: boolean; credentials: { client_email: string; private_key: string };
    pushAudience: string; pushServiceAccount: string };
}): StoreVerifierDependencies {
  const result: StoreVerifierDependencies = { products: options.products };
  if (options.apple) {
    const a = options.apple;
    if (!a.rootCertificates.length || (a.environment === Environment.PRODUCTION && !a.appAppleId)) {
      throw new Error('Apple billing requires trusted root certificates and the production app ID.');
    }
    result.apple = {
      bundleId: a.bundleId, environment: a.environment,
      client: new AppStoreServerAPIClient(a.privateKey, a.keyId, a.issuerId, a.bundleId, a.environment),
      verifier: new SignedDataVerifier(a.rootCertificates, true, a.environment, a.bundleId, a.appAppleId),
      // Sandbox has no app Apple ID; the same key, roots and bundle apply.
      ...(a.environment === Environment.PRODUCTION && a.allowSandboxFallback ? { sandbox: {
        client: new AppStoreServerAPIClient(a.privateKey, a.keyId, a.issuerId, a.bundleId, Environment.SANDBOX),
        verifier: new SignedDataVerifier(a.rootCertificates, true, Environment.SANDBOX, a.bundleId),
      } } : {}),
    };
  }
  if (options.google) {
    const g = options.google;
    const auth = new GoogleAuth({ credentials: g.credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
    const identity = new OAuth2Client();
    const url = (path: string) => `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(g.packageName)}/${path}`;
    result.google = {
      packageName: g.packageName, allowTestPurchases: g.allowTestPurchases,
      pushAudience: g.pushAudience, pushServiceAccount: g.pushServiceAccount,
      get: async (path) => (await auth.request({ url: url(path), method: 'GET', timeout: 15000 })).data,
      post: async (path, data) => (await auth.request({ url: url(path), method: 'POST', data, timeout: 15000 })).data,
      verifyPushToken: async (idToken, audience) => (await identity.verifyIdToken({ idToken, audience })).getPayload(),
    };
  }
  return result;
}
