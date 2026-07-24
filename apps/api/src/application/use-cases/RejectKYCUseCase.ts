import type {
  KYCRepositoryPort,
  KYCVerificationRecord,
} from '../../domain/ports/outbound/KYCRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface RejectKYCInput {
  rejectionReason?: string;
  reviewNotes?: string;
}

export class RejectKYCUseCase {
  constructor(private readonly kycRepo: KYCRepositoryPort) {}

  async execute(
    kycId: string,
    adminId: string,
    input: RejectKYCInput = {}
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

    const now = new Date();
    const updated: KYCVerificationRecord = {
      ...record,
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: input.reviewNotes ?? record.reviewNotes,
      rejectionReason:
        input.rejectionReason ??
        'Documents did not meet verification requirements',
      retryCount: record.retryCount + 1,
      updatedAt: now,
    };

    return this.kycRepo.update(updated);
  }
}
