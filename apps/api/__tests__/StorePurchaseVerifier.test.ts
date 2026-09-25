import { describe, it, expect, vi } from 'vitest';
import { BillingCycle } from '@ubuntu-fund/types';
import { APIError, APIException, Environment, Status, Type, VerificationException, VerificationStatus } from '@apple/app-store-server-library';
import {
  StorePurchaseVerifier, createStoreVerifierDependencies, type StoreVerifierDependencies,
} from '../src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.js';
import { appleSandboxFallbackEnabled } from '../src/infrastructure/config/storeBilling.js';

const now = new Date('2026-09-12T12:00:00Z');
const accountToken = '239a37d9-a34a-4fa2-a845-39d53b7dbfc2';
const products: StoreVerifierDependencies['products'] = [
  { store: 'apple', productId: 'app.plus.monthly', tier: 'starter', billingCycle: BillingCycle.MONTHLY },
  { store: 'apple', productId: 'app.pro.monthly', tier: 'pro', billingCycle: BillingCycle.MONTHLY },
  { store: 'google', productId: 'plus', basePlanId: 'monthly', tier: 'starter', billingCycle: BillingCycle.MONTHLY },
];

function appleFixture() {
  const transaction = {
    transactionId: '102', originalTransactionId: '100', productId: 'app.plus.monthly',
    bundleId: 'com.ujimora.app', environment: Environment.PRODUCTION,
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION, appAccountToken: accountToken,
    purchaseDate: now.getTime() - 86400000, expiresDate: now.getTime() + 86400000,
    inAppOwnershipType: 'PURCHASED',
  };
  const renewal = {
    originalTransactionId: '100', environment: Environment.PRODUCTION, autoRenewStatus: 1,
  };
  const item = { originalTransactionId: '100', signedTransactionInfo: 'current', signedRenewalInfo: 'renewal', status: Status.ACTIVE };
  const client = {
    getTransactionInfo: vi.fn(async () => ({ signedTransactionInfo: 'requested' })),
    getAllSubscriptionStatuses: vi.fn(async () => ({
      bundleId: 'com.ujimora.app', environment: Environment.PRODUCTION, data: [{ lastTransactions: [item] }],
    })),
  };
  const verifier = {
    verifyAndDecodeTransaction: vi.fn(async (signed: string) => signed === 'requested'
      ? { ...transaction, transactionId: '100' } : transaction),
    verifyAndDecodeRenewalInfo: vi.fn(async () => renewal),
    verifyAndDecodeNotification: vi.fn(async () => ({
      notificationType: 'DID_RENEW', data: {
        bundleId: 'com.ujimora.app', environment: Environment.PRODUCTION, signedTransactionInfo: 'current',
      },
    })),
  };
  const service = new StorePurchaseVerifier({ products, now: () => now,
    apple: { client, verifier, bundleId: 'com.ujimora.app', environment: Environment.PRODUCTION } });
  return { service, transaction, renewal, item, client, verifier };
}

function googleFixture() {
  const purchase = {
    startTime: '2026-09-01T12:00:00Z', subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    externalAccountIdentifiers: { obfuscatedExternalAccountId: accountToken },
    lineItems: [{ productId: 'plus', expiryTime: '2026-10-01T12:00:00Z',
      offerDetails: { basePlanId: 'monthly' }, autoRenewingPlan: { autoRenewEnabled: true },
      latestSuccessfulOrderId: 'order-1',
    }],
  };
  const google = {
    packageName: 'com.ujimora.app', allowTestPurchases: false,
    get: vi.fn(async () => purchase), post: vi.fn(async () => ({})),
    pushAudience: 'https://api.example.test/webhooks/google', pushServiceAccount: 'push@example.iam.gserviceaccount.com',
    verifyPushToken: vi.fn(async () => ({
      email: 'push@example.iam.gserviceaccount.com', email_verified: true, iss: 'https://accounts.google.com',
    })),
  };
  return { purchase, google, service: new StorePurchaseVerifier({ products, google, now: () => now }) };
}

describe('App Store verification', () => {
  it('uses current signed status instead of granting from a replayed old transaction', async () => {
    const { service, client, transaction } = appleFixture();
    transaction.productId = 'app.pro.monthly';
    expect(await service.verify('apple', '100')).toMatchObject({
      reference: '100', transactionId: '102', tier: 'pro', active: true, accountToken, environment: 'production',
    });
    expect(client.getAllSubscriptionStatuses).toHaveBeenCalledWith('100');
  });

  it.each([Status.EXPIRED, Status.BILLING_RETRY, Status.REVOKED])('removes entitlement for store status %s', async (status) => {
    const { service, item } = appleFixture();
    item.status = status;
    expect((await service.verify('apple', '100')).active).toBe(false);
  });

  it('uses the signed grace expiry, and fails closed when it is absent', async () => {
    const { service, item, renewal } = appleFixture();
    item.status = Status.BILLING_GRACE_PERIOD;
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 422 });
    Object.assign(renewal, { gracePeriodExpiresDate: now.getTime() + 172800000 });
    expect((await service.verify('apple', '100')).periodEnd.getTime()).toBe(now.getTime() + 172800000);
  });

  it.each([
    { bundleId: 'some.other.app' }, { environment: Environment.SANDBOX },
    { appAccountToken: '' }, { appAccountToken: 'not-a-uuid' },
    { type: Type.CONSUMABLE }, { inAppOwnershipType: 'FAMILY_SHARED' },
    { productId: 'unmapped' }, { purchaseDate: now.getTime() + 1 },
  ])('rejects a transaction outside the supported app, account or product: %j', async (change) => {
    const { service, transaction } = appleFixture();
    Object.assign(transaction, change);
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('does not carry entitlements from refunded or upgraded transactions', async () => {
    const { service, transaction } = appleFixture();
    Object.assign(transaction, { revocationDate: now.getTime() - 1000 });
    expect((await service.verify('apple', '100')).active).toBe(false);
    Object.assign(transaction, { revocationDate: undefined, isUpgraded: true });
    expect((await service.verify('apple', '100')).active).toBe(false);
  });

  it('requires renewal and transaction to refer to the same original purchase', async () => {
    const { service, renewal } = appleFixture();
    renewal.originalTransactionId = 'other';
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a mismatched account between lookup and current transaction', async () => {
    const { service, verifier, transaction } = appleFixture();
    verifier.verifyAndDecodeTransaction.mockImplementation(async (signed) => signed === 'requested'
      ? { ...transaction, transactionId: '100', appAccountToken: 'b57b9a13-9b2d-4772-bb77-a57317b77a62' } : transaction);
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('does not leak SDK request details on signature/API failure', async () => {
    const { service, verifier } = appleFixture();
    verifier.verifyAndDecodeTransaction.mockRejectedValue(new Error('private key: secret'));
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 503 });
    await expect(service.verify('apple', '100')).rejects.not.toThrow('secret');
  });

  it('requires real signature verification for notifications and only returns a lookup key', async () => {
    const { service, verifier } = appleFixture();
    expect(await service.appleNotification('signed-event')).toBe('102');
    expect(verifier.verifyAndDecodeNotification).toHaveBeenCalledWith('signed-event');
    verifier.verifyAndDecodeNotification.mockRejectedValue(new Error('invalid signature'));
    await expect(service.appleNotification('forged')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('requires production app ID and trusted roots when creating the official verifier', () => {
    expect(() => createStoreVerifierDependencies({ products, apple: {
      privateKey: '', keyId: '', issuerId: '', bundleId: 'com.ujimora.app', environment: Environment.PRODUCTION,
      rootCertificates: [],
    } })).toThrow('trusted root certificates');
  });
});

/** One App Store environment's client + verifier doubles, all data stamped with that environment. */
function applePair(environment: Environment) {
  const transaction = {
    transactionId: '102', originalTransactionId: '100', productId: 'app.plus.monthly',
    bundleId: 'com.ujimora.app', environment, type: Type.AUTO_RENEWABLE_SUBSCRIPTION, appAccountToken: accountToken,
    purchaseDate: now.getTime() - 60_000, expiresDate: now.getTime() + 300_000, inAppOwnershipType: 'PURCHASED',
  };
  const item = { originalTransactionId: '100', signedTransactionInfo: 'current', signedRenewalInfo: 'renewal', status: Status.ACTIVE };
  const client = {
    getTransactionInfo: vi.fn(async (): Promise<{ signedTransactionInfo?: string }> => ({ signedTransactionInfo: 'requested' })),
    getAllSubscriptionStatuses: vi.fn(async () => ({ bundleId: 'com.ujimora.app', environment, data: [{ lastTransactions: [item] }] })),
  };
  const verifier = {
    verifyAndDecodeTransaction: vi.fn(async (signed: string) => signed === 'requested' ? { ...transaction, transactionId: '100' } : transaction),
    verifyAndDecodeRenewalInfo: vi.fn(async () => ({ originalTransactionId: '100', environment, autoRenewStatus: 1 })),
    verifyAndDecodeNotification: vi.fn(async (): Promise<unknown> => ({
      notificationType: 'SUBSCRIBED', data: { bundleId: 'com.ujimora.app', environment, signedTransactionInfo: 'current' },
    })),
  };
  return { client, verifier, transaction };
}

function reviewFixture(withSandbox = true) {
  const production = applePair(Environment.PRODUCTION);
  const sandbox = applePair(Environment.SANDBOX);
  // What production answers for an App Review / TestFlight transaction.
  production.client.getTransactionInfo.mockRejectedValue(new APIException(404, APIError.TRANSACTION_ID_NOT_FOUND, 'Transaction id not found.'));
  production.verifier.verifyAndDecodeNotification.mockRejectedValue(new VerificationException(VerificationStatus.INVALID_ENVIRONMENT));
  const service = new StorePurchaseVerifier({ products, now: () => now, apple: {
    client: production.client, verifier: production.verifier, bundleId: 'com.ujimora.app', environment: Environment.PRODUCTION,
    ...(withSandbox ? { sandbox: { client: sandbox.client, verifier: sandbox.verifier } } : {}),
  } });
  return { service, production, sandbox };
}

describe('App Store sandbox fallback for App Review / TestFlight', () => {
  it('verifies in production first, then in sandbox, and marks the purchase sandbox', async () => {
    const { service, production, sandbox } = reviewFixture();
    expect(await service.verify('apple', '100')).toMatchObject({ environment: 'sandbox', active: true, tier: 'starter', reference: '100' });
    expect(production.client.getTransactionInfo).toHaveBeenCalledWith('100');
    expect(sandbox.client.getTransactionInfo).toHaveBeenCalledWith('100');
    expect(sandbox.client.getAllSubscriptionStatuses).toHaveBeenCalledWith('100');
  });

  it('keeps a real production purchase in production without consulting sandbox', async () => {
    const { service, production, sandbox } = reviewFixture();
    production.client.getTransactionInfo.mockResolvedValue({ signedTransactionInfo: 'requested' });
    expect((await service.verify('apple', '100')).environment).toBe('production');
    expect(sandbox.client.getTransactionInfo).not.toHaveBeenCalled();
  });

  it('rejects a sandbox receipt when the fallback is disabled', async () => {
    const { service, sandbox } = reviewFixture(false);
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 422 });
    expect(sandbox.client.getTransactionInfo).not.toHaveBeenCalled();
  });

  it('does not fall back on a production outage', async () => {
    const { service, production, sandbox } = reviewFixture();
    production.client.getTransactionInfo.mockRejectedValue(new APIException(500, APIError.GENERAL_INTERNAL));
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 503 });
    expect(sandbox.client.getTransactionInfo).not.toHaveBeenCalled();
  });

  it('checks the environment against the verifier actually used', async () => {
    const { service, sandbox } = reviewFixture();
    sandbox.transaction.environment = Environment.PRODUCTION;
    await expect(service.verify('apple', '100')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('accepts a sandbox server notification only with the fallback enabled', async () => {
    const enabled = reviewFixture();
    expect(await enabled.service.appleNotification('signed-sandbox-event')).toBe('102');
    expect(enabled.sandbox.verifier.verifyAndDecodeNotification).toHaveBeenCalledWith('signed-sandbox-event');
    await expect(reviewFixture(false).service.appleNotification('signed-sandbox-event')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('never uses the sandbox verifier for a forged notification', async () => {
    const { service, production, sandbox } = reviewFixture();
    production.verifier.verifyAndDecodeNotification.mockRejectedValue(new VerificationException(VerificationStatus.VERIFICATION_FAILURE));
    await expect(service.appleNotification('forged')).rejects.toMatchObject({ statusCode: 401 });
    expect(sandbox.verifier.verifyAndDecodeNotification).not.toHaveBeenCalled();
  });

  it('enables the fallback by default and lets operators turn it off', () => {
    expect(appleSandboxFallbackEnabled({})).toBe(true);
    expect(appleSandboxFallbackEnabled({ APPLE_IAP_ALLOW_SANDBOX_FALLBACK: 'true' })).toBe(true);
    expect(appleSandboxFallbackEnabled({ APPLE_IAP_ALLOW_SANDBOX_FALLBACK: 'false' })).toBe(false);
    expect(() => appleSandboxFallbackEnabled({ APPLE_IAP_ALLOW_SANDBOX_FALLBACK: 'yes' })).toThrow();
  });
});

describe('Google Play verification', () => {
  it('verifies the purchase token via the package-scoped V2 API, then acknowledges separately', async () => {
    const { service, google } = googleFixture();
    const result = await service.verify('google', 'private/token');
    expect(result).toMatchObject({ tier: 'starter', active: true, accountToken, needsAcknowledgement: true });
    expect(google.get).toHaveBeenCalledWith('purchases/subscriptionsv2/tokens/private%2Ftoken');
    expect(google.post).not.toHaveBeenCalled();
    await service.acknowledge(result);
    expect(google.post).toHaveBeenCalledWith('purchases/subscriptions/plus/tokens/private%2Ftoken:acknowledge', {});
  });

  it.each(['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_ON_HOLD',
    'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED', 'unknown'])
  ('does not grant or acknowledge state %s', async (state) => {
    const { service, purchase, google } = googleFixture();
    purchase.subscriptionState = state;
    const result = await service.verify('google', 'token');
    expect(result.active).toBe(false);
    await service.acknowledge(result);
    expect(google.post).not.toHaveBeenCalled();
  });

  it('preserves paid access after cancellation until authoritative expiry', async () => {
    const { service, purchase } = googleFixture();
    purchase.subscriptionState = 'SUBSCRIPTION_STATE_CANCELED';
    purchase.lineItems[0].autoRenewingPlan.autoRenewEnabled = false;
    expect(await service.verify('google', 'token')).toMatchObject({ active: true, autoRenew: false });
    purchase.lineItems[0].expiryTime = '2026-09-11T12:00:00Z';
    expect((await service.verify('google', 'token')).active).toBe(false);
  });

  it('rejects sandbox purchases on a production-only verifier', async () => {
    const { service, purchase } = googleFixture();
    Object.assign(purchase, { testPurchase: {} });
    await expect(service.verify('google', 'token')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects unmapped base plans, missing account binding and unsupported multi-item purchases', async () => {
    const { service, purchase } = googleFixture();
    purchase.lineItems[0].offerDetails.basePlanId = 'unknown';
    await expect(service.verify('google', 'token')).rejects.toMatchObject({ statusCode: 422 });
    purchase.lineItems[0].offerDetails.basePlanId = 'monthly';
    purchase.externalAccountIdentifiers.obfuscatedExternalAccountId = '';
    await expect(service.verify('google', 'token')).rejects.toMatchObject({ statusCode: 422 });
    purchase.externalAccountIdentifiers.obfuscatedExternalAccountId = accountToken;
    purchase.lineItems.push(purchase.lineItems[0]);
    await expect(service.verify('google', 'token')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('returns linked-token information so the settlement layer can retire the old entitlement', async () => {
    const { service, purchase } = googleFixture();
    Object.assign(purchase, { linkedPurchaseToken: 'previous-private-token' });
    expect((await service.verify('google', 'replacement')).linkedReference).toBe('previous-private-token');
  });

  it('sanitizes acknowledgement failures for durable retry', async () => {
    const { service, google } = googleFixture();
    google.post.mockRejectedValue(new Error('Authorization: secret'));
    await expect(service.acknowledge(await service.verify('google', 'token')))
      .rejects.toMatchObject({ statusCode: 503, message: 'The store acknowledgement needs a retry.' });
  });

  const envelope = (packageName = 'com.ujimora.app') => ({ message: {
    data: Buffer.from(JSON.stringify({ packageName, subscriptionNotification: { purchaseToken: 'renewal-token' } })).toString('base64'),
  } });

  it('authenticates push audience and service-account identity before accepting a notification', async () => {
    const { service, google } = googleFixture();
    expect(await service.googleNotification('Bearer oidc', envelope())).toBe('renewal-token');
    expect(google.verifyPushToken).toHaveBeenCalledWith('oidc', google.pushAudience);
    await expect(service.googleNotification('', envelope())).rejects.toMatchObject({ statusCode: 401 });
    google.verifyPushToken.mockResolvedValue({ email: 'attacker@example.com', email_verified: true, iss: 'https://accounts.google.com' });
    await expect(service.googleNotification('Bearer oidc', envelope())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a wrong package, unverified sender, wrong issuer and malformed envelope', async () => {
    const { service, google } = googleFixture();
    await expect(service.googleNotification('Bearer oidc', envelope('other.app'))).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.googleNotification('Bearer oidc', { message: { data: 'bad-json' } })).rejects.toMatchObject({ statusCode: 401 });
    google.verifyPushToken.mockResolvedValue({ email: google.pushServiceAccount, email_verified: false, iss: 'https://accounts.google.com' });
    await expect(service.googleNotification('Bearer oidc', envelope())).rejects.toMatchObject({ statusCode: 401 });
    google.verifyPushToken.mockResolvedValue({ email: google.pushServiceAccount, email_verified: true, iss: 'attacker' });
    await expect(service.googleNotification('Bearer oidc', envelope())).rejects.toMatchObject({ statusCode: 401 });
  });
});
