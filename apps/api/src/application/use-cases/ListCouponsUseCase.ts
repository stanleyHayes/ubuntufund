import type { Coupon } from '@ubuntu-fund/types';
import type {
  CouponRepositoryPort,
  CouponListFilter,
} from '../../domain/ports/outbound/CouponRepositoryPort.js';
import { toCouponDto } from './mappers/couponDto.js';

/** List every coupon, newest first (admin console); optionally filtered by active. */
export class ListCouponsUseCase {
  constructor(private readonly couponRepo: CouponRepositoryPort) {}

  async execute(filter?: CouponListFilter): Promise<Coupon[]> {
    const coupons = await this.couponRepo.findAll(filter);
    return coupons.map(toCouponDto);
  }
}
