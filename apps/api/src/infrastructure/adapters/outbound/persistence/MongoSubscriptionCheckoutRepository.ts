import type { SubscriptionCheckout } from '@ubuntu-fund/types';
import { SubscriptionCheckoutStatus } from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import {
  SubscriptionCheckoutModel,
  type SubscriptionCheckoutDocument,
} from '../../../database/models/SubscriptionCheckoutModel.js';

function toDomain(doc: SubscriptionCheckoutDocument): SubscriptionCheckout {
  return {
    id: doc._id!.toString(),
    userId: doc.userId,
    tier: doc.tier,
    billingCycle: doc.billingCycle,
    status: doc.status,
    baseAmount: doc.baseAmount,
    discountAmount: doc.discountAmount,
    finalAmount: doc.finalAmount,
    currency: doc.currency,
    couponId: doc.couponId,
    couponCode: doc.couponCode,
    commissionBase: doc.commissionBase,
    providerRef: doc.providerRef,
    ...(doc.authorizationUrl ? { authorizationUrl: doc.authorizationUrl } : {}),
    ...(doc.accessCode ? { accessCode: doc.accessCode } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoSubscriptionCheckoutRepository
  implements SubscriptionCheckoutRepositoryPort
{
  async create(checkout: SubscriptionCheckout): Promise<SubscriptionCheckout> {
    const doc = await SubscriptionCheckoutModel.create({
      userId: checkout.userId,
      tier: checkout.tier,
      billingCycle: checkout.billingCycle,
      status: checkout.status,
      baseAmount: checkout.baseAmount,
      discountAmount: checkout.discountAmount,
      finalAmount: checkout.finalAmount,
      currency: checkout.currency,
      couponId: checkout.couponId,
      couponCode: checkout.couponCode,
      commissionBase: checkout.commissionBase,
      providerRef: checkout.providerRef,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<SubscriptionCheckout | null> {
    const doc = await SubscriptionCheckoutModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByProviderRef(
    providerRef: string
  ): Promise<SubscriptionCheckout | null> {
    const doc = await SubscriptionCheckoutModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async setProviderRef(
    id: string,
    providerRef: string,
    page: { authorizationUrl?: string; accessCode?: string } = {}
  ): Promise<SubscriptionCheckout | null> {
    // Attaches the charge reference after the checkout is created, so the signed
    // webhook can correlate the settlement back to it (the unique+sparse index
    // guarantees at most one checkout per reference).
    const doc = await SubscriptionCheckoutModel.findByIdAndUpdate(
      id,
      {
        $set: {
          providerRef,
          ...(page.authorizationUrl ? { authorizationUrl: page.authorizationUrl } : {}),
          ...(page.accessCode ? { accessCode: page.accessCode } : {}),
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToSucceeded(
    id: string
  ): Promise<SubscriptionCheckout | null> {
    // Single exactly-once settlement gate: only fires while PENDING (or EXPIRED,
    // for a charge the provider confirmed after we gave up on it), so at most
    // one settlement ever activates the subscription. Null => already
    // SUCCEEDED (another settlement won) or FAILED.
    const doc = await SubscriptionCheckoutModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [SubscriptionCheckoutStatus.PENDING, SubscriptionCheckoutStatus.EXPIRED] },
      },
      { $set: { status: SubscriptionCheckoutStatus.SUCCEEDED } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToExpired(id: string): Promise<SubscriptionCheckout | null> {
    const doc = await SubscriptionCheckoutModel.findOneAndUpdate(
      { _id: id, status: SubscriptionCheckoutStatus.PENDING },
      { $set: { status: SubscriptionCheckoutStatus.EXPIRED } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async findStalePending(olderThan: Date, limit: number): Promise<SubscriptionCheckout[]> {
    const docs = await SubscriptionCheckoutModel.find({
      status: SubscriptionCheckoutStatus.PENDING,
      createdAt: { $lt: olderThan },
    })
      // Never-visited rows (field absent) sort first, then the least recently
      // visited: checkouts Paystack keeps in flight, or that keep failing
      // verification, rotate instead of pinning the head of every sweep.
      .sort({ reconciledAt: 1, createdAt: 1, _id: 1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async recordReconciliationAttempt(id: string, attemptedAt: Date): Promise<void> {
    await SubscriptionCheckoutModel.updateOne(
      { _id: id, status: SubscriptionCheckoutStatus.PENDING },
      { $max: { reconciledAt: attemptedAt } },
      { timestamps: false }
    );
  }

  async findPendingByUser(userId: string, limit: number): Promise<SubscriptionCheckout[]> {
    const docs = await SubscriptionCheckoutModel.find({
      userId,
      status: SubscriptionCheckoutStatus.PENDING,
    })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async transitionToFailed(id: string): Promise<SubscriptionCheckout | null> {
    const doc = await SubscriptionCheckoutModel.findOneAndUpdate(
      { _id: id, status: SubscriptionCheckoutStatus.PENDING },
      { $set: { status: SubscriptionCheckoutStatus.FAILED } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
