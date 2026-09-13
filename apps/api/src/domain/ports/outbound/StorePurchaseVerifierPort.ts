import type { BillingCycle } from '@ubuntu-fund/types';

export type BillingStore = 'apple' | 'google';

/** Server-owned catalog. Never accept a client-supplied tier or expiry. */
export interface StoreProduct {
  store: BillingStore;
  productId: string;
  basePlanId?: string;
  tier: string;
  billingCycle: BillingCycle;
}

export interface VerifiedStorePurchase extends StoreProduct {
  /** Apple originalTransactionId; Google purchaseToken. Treat as sensitive. */
  reference: string;
  transactionId: string;
  accountToken: string;
  periodStart: Date;
  periodEnd: Date;
  active: boolean;
  pending: boolean;
  autoRenew: boolean;
  environment: 'production' | 'sandbox';
  needsAcknowledgement: boolean;
  /** Replacements must retire the old entitlement, without transferring ownership. */
  linkedReference?: string;
  verifiedAt: Date;
}

export interface StorePurchaseVerifierPort {
  verify(store: BillingStore, reference: string): Promise<VerifiedStorePurchase>;
  /** Call only after durable entitlement persistence, never before it. */
  acknowledge(purchase: VerifiedStorePurchase): Promise<void>;
  appleNotification(signedPayload: string): Promise<string | null>;
  googleNotification(authorization: string, envelope: unknown): Promise<string | null>;
}
