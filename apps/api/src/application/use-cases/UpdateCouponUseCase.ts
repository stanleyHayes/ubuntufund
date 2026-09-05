import {
  CouponDiscountType,
  type Coupon,
  type UpdateCouponInput,
} from '@ubuntu-fund/types';
import { CouponEntity } from '../../domain/entities/Coupon.js';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCouponDto } from './mappers/couponDto.js';

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
 * Edit a coupon (admin console). The code is immutable after creation (it is not
 * part of {@link UpdateCouponInput} and is never rewritten), and the running
 * `redemptions` counter is owned by the atomic settlement gate — both survive
 * untouched. Only the fields present on the input are changed; the rest keep
 * their current values. A missing coupon returns 404; broken amount/date
 * invariants return 400.
 */
export class UpdateCouponUseCase {
  constructor(private readonly couponRepo: CouponRepositoryPort) {}

  async execute(id: string, input: UpdateCouponInput): Promise<Coupon> {
    const existing = await this.couponRepo.findById(id);
    if (!existing) {
      throw new AppError('Coupon not found', 404);
    }
    const current = existing.toPlain();

    const discountType = input.discountType ?? current.discountType;
    const amount = input.amount ?? current.amount;
    if (amount <= 0) {
      throw new AppError('Coupon amount must be greater than zero', 400);
    }
    if (discountType === CouponDiscountType.PERCENT && amount > 100) {
      throw new AppError('Percent coupon amount cannot exceed 100', 400);
    }

    const validFrom =
      input.validFrom !== undefined
        ? toDate(input.validFrom, 'validFrom')
        : current.validFrom;
    const validUntil =
      input.validUntil !== undefined
        ? toDate(input.validUntil, 'validUntil')
        : current.validUntil;
    if (validFrom && validUntil && validFrom > validUntil) {
      throw new AppError('validFrom cannot be after validUntil', 400);
    }

    const updated = new CouponEntity({
      ...current, // preserves id, code, currency, redemptions, createdAt
      description:
        input.description !== undefined
          ? input.description
          : current.description,
      discountType,
      amount,
      maxRedemptions:
        input.maxRedemptions !== undefined
          ? input.maxRedemptions
          : current.maxRedemptions,
      perUserLimit:
        input.perUserLimit !== undefined
          ? input.perUserLimit
          : current.perUserLimit,
      minSubtotal:
        input.minSubtotal !== undefined
          ? input.minSubtotal
          : current.minSubtotal,
      appliesToTiers:
        input.appliesToTiers !== undefined
          ? input.appliesToTiers
          : current.appliesToTiers,
      appliesToBillingCycles:
        input.appliesToBillingCycles !== undefined
          ? input.appliesToBillingCycles
          : current.appliesToBillingCycles,
      validFrom,
      validUntil,
      active: input.active !== undefined ? input.active : current.active,
      updatedAt: new Date(),
    });

    const saved = await this.couponRepo.update(updated);
    return toCouponDto(saved);
  }
}
