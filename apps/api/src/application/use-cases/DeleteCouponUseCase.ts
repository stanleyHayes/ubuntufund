import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Delete an UNUSED coupon by id (admin console). 404 when it does not exist.
 *
 * A coupon that was ever applied (a counted redemption, or any redemption slot
 * — including one held by a checkout that has not settled yet) is refused with
 * 409: hard-deleting it would let a later settlement lose the coupon's
 * commission basis, and recreating the same code would start its global and
 * per-user limits again from zero. Used coupons are deactivated instead.
 */
export class DeleteCouponUseCase {
  constructor(
    private readonly couponRepo: CouponRepositoryPort,
    private readonly couponRedemptionRepo: CouponRedemptionRepositoryPort
  ) {}

  async execute(id: string): Promise<void> {
    const coupon = await this.couponRepo.findById(id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }
    if (coupon.redemptions > 0 || (await this.couponRedemptionRepo.existsForCoupon(id))) {
      throw new AppError('This coupon has been used — deactivate it instead.', 409);
    }
    await this.couponRepo.delete(id);
  }
}
