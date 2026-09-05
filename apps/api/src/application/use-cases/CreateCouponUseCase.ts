import {
  CouponDiscountType,
  type Coupon,
  type CreateCouponInput,
} from '@ubuntu-fund/types';
import { CouponEntity } from '../../domain/entities/Coupon.js';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCouponDto } from './mappers/couponDto.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/** Coerce an optional ISO date string to a Date, rejecting an unparseable one. */
function toDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${field} date`, 400);
  }
  return date;
}

/**
 * Create a discount coupon (admin console). The code is normalised to UPPERCASE
 * and must be unique — a collision returns 409. ISO date strings arriving over
 * the wire are coerced to Dates, and the amount invariants (positive; percent
 * never above 100) are enforced up front as 400s.
 */
export class CreateCouponUseCase {
  constructor(private readonly couponRepo: CouponRepositoryPort) {}

  async execute(input: CreateCouponInput): Promise<Coupon> {
    const code = input.code?.trim().toUpperCase();
    if (!code) {
      throw new AppError('Coupon code is required', 400);
    }

    const existing = await this.couponRepo.findByCode(code);
    if (existing) {
      throw new AppError('A coupon with this code already exists', 409);
    }

    if (typeof input.amount !== 'number' || input.amount <= 0) {
      throw new AppError('Coupon amount must be greater than zero', 400);
    }
    if (
      input.discountType === CouponDiscountType.PERCENT &&
      input.amount > 100
    ) {
      throw new AppError('Percent coupon amount cannot exceed 100', 400);
    }

    const validFrom = toDate(input.validFrom, 'validFrom');
    const validUntil = toDate(input.validUntil, 'validUntil');
    if (validFrom && validUntil && validFrom > validUntil) {
      throw new AppError('validFrom cannot be after validUntil', 400);
    }

    const now = new Date();
    const coupon = new CouponEntity({
      id: '', // Assigned by the repository
      code,
      description: input.description,
      discountType: input.discountType,
      amount: input.amount,
      currency: CURRENCY,
      maxRedemptions: input.maxRedemptions,
      redemptions: 0,
      perUserLimit: input.perUserLimit,
      minSubtotal: input.minSubtotal,
      appliesToTiers: input.appliesToTiers ?? [],
      appliesToBillingCycles: input.appliesToBillingCycles ?? [],
      validFrom,
      validUntil,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.couponRepo.create(coupon);
    return toCouponDto(saved);
  }
}
