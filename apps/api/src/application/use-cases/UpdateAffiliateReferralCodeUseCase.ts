import type { Affiliate } from '@ubuntu-fund/types';
import {
  normalizeReferralCode,
  referralCodeProblemMessage,
  validateReferralCode,
} from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Let an affiliate replace their auto-generated code with one they chose.
 *
 * The code is the affiliate's public identity — it appears in every link they
 * share — so a memorable one is worth more to them than the random short code
 * minted at enrollment.
 *
 * Changing it RETIRES the previous code: `?ref=` resolves a single affiliate by
 * exact code, so links already printed or shared under the old one stop
 * attributing. The UI says so before confirming. Referrals and commissions
 * already attributed are unaffected — they are stored by affiliate id, not code.
 */
export class UpdateAffiliateReferralCodeUseCase {
  constructor(private readonly affiliateRepo: AffiliateRepositoryPort) {}

  async execute(userId: string, requestedCode: string): Promise<Affiliate> {
    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Join the affiliate program before setting a code', 404);
    }

    const code = normalizeReferralCode(requestedCode ?? '');
    const problem = validateReferralCode(code);
    if (problem) {
      throw new AppError(referralCodeProblemMessage(problem), 422);
    }

    // Idempotent: re-submitting the current code is a no-op, not a conflict.
    if (code === normalizeReferralCode(affiliate.referralCode)) {
      return affiliate;
    }

    if (await this.affiliateRepo.referralCodeExists(code)) {
      throw new AppError('That code is already taken. Try another.', 409);
    }

    const updated = await this.affiliateRepo.updateReferralCode(affiliate.id, code);
    if (!updated) {
      // Lost a race for the same code: the unique index rejected the write.
      throw new AppError('That code is already taken. Try another.', 409);
    }
    return updated;
  }
}
