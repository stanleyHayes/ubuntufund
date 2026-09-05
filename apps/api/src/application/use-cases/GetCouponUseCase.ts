import type { Coupon } from '@ubuntu-fund/types';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCouponDto } from './mappers/couponDto.js';

/** Fetch a single coupon by id (admin console). 404 when it does not exist. */
export class GetCouponUseCase {
  constructor(private readonly couponRepo: CouponRepositoryPort) {}

  async execute(id: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findById(id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }
    return toCouponDto(coupon);
  }
}
