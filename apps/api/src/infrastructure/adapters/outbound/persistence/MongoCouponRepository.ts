import { CouponEntity } from '../../../../domain/entities/Coupon.js';
import type {
  CouponRepositoryPort,
  CouponListFilter,
} from '../../../../domain/ports/outbound/CouponRepositoryPort.js';
import {
  CouponModel,
  type CouponDocument,
} from '../../../database/models/CouponModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

function toDomain(doc: CouponDocument): CouponEntity {
  return new CouponEntity({
    id: doc._id!.toString(),
    code: doc.code,
    description: doc.description,
    discountType: doc.discountType,
    amount: doc.amount,
    maxDiscountAmount: doc.maxDiscountAmount,
    currency: doc.currency,
    maxRedemptions: doc.maxRedemptions,
    redemptions: doc.redemptions,
    perUserLimit: doc.perUserLimit,
    minSubtotal: doc.minSubtotal,
    appliesToTiers: doc.appliesToTiers,
    appliesToBillingCycles: doc.appliesToBillingCycles,
    newUsersOnly: doc.newUsersOnly,
    allowedEmails: doc.allowedEmails,
    validFrom: doc.validFrom,
    validUntil: doc.validUntil,
    active: doc.active,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoCouponRepository implements CouponRepositoryPort {
  async create(coupon: CouponEntity): Promise<CouponEntity> {
    const c = coupon.toPlain();
    const doc = await CouponModel.create({
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      amount: c.amount,
      maxDiscountAmount: c.maxDiscountAmount,
      currency: c.currency,
      maxRedemptions: c.maxRedemptions,
      redemptions: c.redemptions,
      perUserLimit: c.perUserLimit,
      minSubtotal: c.minSubtotal,
      appliesToTiers: c.appliesToTiers,
      appliesToBillingCycles: c.appliesToBillingCycles,
      newUsersOnly: c.newUsersOnly,
      allowedEmails: c.allowedEmails,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      active: c.active,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CouponEntity | null> {
    const doc = await CouponModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCode(code: string): Promise<CouponEntity | null> {
    // Codes are stored and matched UPPERCASE.
    const doc = await CouponModel.findOne({ code: code.toUpperCase() });
    return doc ? toDomain(doc) : null;
  }

  async findAll(filter?: CouponListFilter): Promise<CouponEntity[]> {
    const query =
      filter?.active === undefined ? {} : { active: filter.active };
    const docs = await CouponModel.find(query).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async update(coupon: CouponEntity): Promise<CouponEntity> {
    const c = coupon.toPlain();
    // Code is immutable; `redemptions` is owned by the atomic increment gate, so
    // neither is written back here.
    const doc = await CouponModel.findByIdAndUpdate(
      c.id,
      {
        $set: {
          description: c.description,
          discountType: c.discountType,
          amount: c.amount,
          maxDiscountAmount: c.maxDiscountAmount,
          currency: c.currency,
          maxRedemptions: c.maxRedemptions,
          perUserLimit: c.perUserLimit,
          minSubtotal: c.minSubtotal,
          appliesToTiers: c.appliesToTiers,
          appliesToBillingCycles: c.appliesToBillingCycles,
          newUsersOnly: c.newUsersOnly,
          allowedEmails: c.allowedEmails,
          validFrom: c.validFrom,
          validUntil: c.validUntil,
          active: c.active,
        },
      },
      { new: true }
    );
    if (!doc) {
      throw new AppError('Coupon not found', 404);
    }
    return toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await CouponModel.findByIdAndDelete(id);
  }

  async incrementRedemptionIfUnderLimit(
    id: string
  ): Promise<CouponEntity | null> {
    // Single global-limit gate: bump `redemptions` only while the coupon is
    // unlimited (falsy maxRedemptions) or still under its cap. Concurrent
    // settlements race here, and at most `maxRedemptions` of them can win.
    const doc = await CouponModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { maxRedemptions: { $in: [null, 0] } },
          { $expr: { $lt: ['$redemptions', '$maxRedemptions'] } },
        ],
      },
      { $inc: { redemptions: 1 } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
