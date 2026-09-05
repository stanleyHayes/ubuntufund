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
    providerRef: doc.providerRef,
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
    providerRef: string
  ): Promise<SubscriptionCheckout | null> {
    // Attaches the charge reference after the checkout is created, so the signed
    // webhook can correlate the settlement back to it (the unique+sparse index
    // guarantees at most one checkout per reference).
    const doc = await SubscriptionCheckoutModel.findByIdAndUpdate(
      id,
      { $set: { providerRef } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToSucceeded(
    id: string
  ): Promise<SubscriptionCheckout | null> {
    // Single exactly-once settlement gate: only fires while still PENDING, so at
    // most one signed webhook ever activates the subscription. Null => already
    // terminal (another settlement won, or it failed/expired).
    const doc = await SubscriptionCheckoutModel.findOneAndUpdate(
      { _id: id, status: SubscriptionCheckoutStatus.PENDING },
      { $set: { status: SubscriptionCheckoutStatus.SUCCEEDED } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
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
