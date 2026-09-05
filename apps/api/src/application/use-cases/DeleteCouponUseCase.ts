import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Delete a coupon by id (admin console). 404 when it does not exist. */
export class DeleteCouponUseCase {
  constructor(private readonly couponRepo: CouponRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const coupon = await this.couponRepo.findById(id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }
    await this.couponRepo.delete(id);
  }
}
