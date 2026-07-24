import { VerificationLevel } from '@ubuntu-fund/types';
import type { VerificationType } from '@ubuntu-fund/types';
import { UserEntity } from '../../domain/entities/User.js';
import type {
  KYCRepositoryPort,
  KYCVerificationRecord,
} from '../../domain/ports/outbound/KYCRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Minimum verificationLevel a user should hold once a given verification
 * type is approved. This is what unblocks campaign creation — see
 * CAMPAIGN_LIMITS_BY_VERIFICATION in domain/entities/User.ts.
 */
const VERIFICATION_LEVEL_BY_TYPE: Record<VerificationType, VerificationLevel> =
  {
    identity: VerificationLevel.NATIONAL_ID,
    address: VerificationLevel.NATIONAL_ID,
    business: VerificationLevel.INSTITUTIONAL,
    political: VerificationLevel.COMMUNITY,
    media: VerificationLevel.COMMUNITY,
  };

const APPROVAL_VALIDITY_DAYS = 365;

export interface ApproveKYCInput {
  reviewNotes?: string;
}

export class ApproveKYCUseCase {
  constructor(
    private readonly kycRepo: KYCRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async execute(
    kycId: string,
    adminId: string,
    input: ApproveKYCInput = {}
  ): Promise<KYCVerificationRecord> {
    const record = await this.kycRepo.findById(kycId);
    if (!record) {
      throw new AppError('KYC verification not found', 404);
    }

    if (record.status !== 'pending' && record.status !== 'in_review') {
      throw new AppError(
        `KYC verification has already been ${record.status}`,
        409
      );
    }

    // Validate the submitting user still exists before persisting the
    // approval, so a stale/deleted userId can't leave the KYC record
    // permanently approved with the verification-level bump silently skipped.
    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + APPROVAL_VALIDITY_DAYS);

    const updated: KYCVerificationRecord = {
      ...record,
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: input.reviewNotes ?? record.reviewNotes,
      expiryDate,
      updatedAt: now,
    };

    const saved = await this.kycRepo.update(updated);

    // Raise the user's verificationLevel so campaign creation unblocks.
    const targetLevel = VERIFICATION_LEVEL_BY_TYPE[record.verificationType];
    if (targetLevel > user.verificationLevel) {
      const plain = user.toPlain();
      const nextUser = new UserEntity({
        ...plain,
        verificationLevel: targetLevel,
        updatedAt: now,
      });
      await this.userRepo.update(nextUser);
    }

    return saved;
  }
}
