import type { CouponRedemption } from '@ubuntu-fund/types';
import { CouponRedemptionStatus } from '@ubuntu-fund/types';
import type { CouponRedemptionRepositoryPort } from '../../../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import {
  CouponRedemptionModel,
  type CouponRedemptionDocument,
} from '../../../database/models/CouponRedemptionModel.js';

function toDomain(doc: CouponRedemptionDocument): CouponRedemption {
  return {
    id: doc._id!.toString(),
    couponId: doc.couponId,
    code: doc.code,
    userId: doc.userId,
    subscriptionId: doc.subscriptionId,
    checkoutId: doc.checkoutId,
    tier: doc.tier,
    billingCycle: doc.billingCycle,
    status: doc.status,
    baseAmount: doc.baseAmount,
    discountAmount: doc.discountAmount,
    finalAmount: doc.finalAmount,
    currency: doc.currency,
    providerRef: doc.providerRef,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoCouponRedemptionRepository
  implements CouponRedemptionRepositoryPort
{
  async create(redemption: CouponRedemption): Promise<CouponRedemption> {
    const doc = await CouponRedemptionModel.create({
      couponId: redemption.couponId,
      code: redemption.code,
      userId: redemption.userId,
      subscriptionId: redemption.subscriptionId,
      checkoutId: redemption.checkoutId,
      tier: redemption.tier,
      billingCycle: redemption.billingCycle,
      status: redemption.status,
      baseAmount: redemption.baseAmount,
      discountAmount: redemption.discountAmount,
      finalAmount: redemption.finalAmount,
      currency: redemption.currency,
      providerRef: redemption.providerRef,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CouponRedemption | null> {
    const doc = await CouponRedemptionModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByProviderRef(
    providerRef: string
  ): Promise<CouponRedemption | null> {
    const doc = await CouponRedemptionModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async setProviderRef(
    id: string,
    providerRef: string
  ): Promise<CouponRedemption | null> {
    // Correlates the provisional slot with its checkout's charge reference; the
    // unique+sparse index keeps it one-redemption-per-reference.
    const doc = await CouponRedemptionModel.findByIdAndUpdate(
      id,
      { $set: { providerRef } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async countByCouponAndUser(
    couponId: string,
    userId: string
  ): Promise<number> {
    // RELEASED slots were freed, so they never count against the per-user limit;
    // PENDING and CONSUMED both still hold a seat.
    return CouponRedemptionModel.countDocuments({
      couponId,
      userId,
      status: { $ne: CouponRedemptionStatus.RELEASED },
    });
  }

  async markConsumed(id: string): Promise<CouponRedemption | null> {
    // Conditional atomic transition: only fires while still PENDING, so a
    // duplicate settlement can never double-consume a slot.
    const doc = await CouponRedemptionModel.findOneAndUpdate(
      { _id: id, status: CouponRedemptionStatus.PENDING },
      { $set: { status: CouponRedemptionStatus.CONSUMED } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async markReleased(id: string): Promise<CouponRedemption | null> {
    const doc = await CouponRedemptionModel.findOneAndUpdate(
      { _id: id, status: CouponRedemptionStatus.PENDING },
      { $set: { status: CouponRedemptionStatus.RELEASED } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async attachSubscription(
    id: string,
    subscriptionId: string
  ): Promise<CouponRedemption | null> {
    const doc = await CouponRedemptionModel.findByIdAndUpdate(
      id,
      { $set: { subscriptionId } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
