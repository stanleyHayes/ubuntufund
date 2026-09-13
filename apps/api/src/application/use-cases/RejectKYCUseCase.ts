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

    const reason = input.rejectionReason?.trim();
    if (!reason || reason.length < 20 || reason.length > 1000) throw new AppError('Provide an applicant-facing reason of 20 to 1000 characters.', 422);
    const now = new Date();
    const updated: KYCVerificationRecord = {
      ...record,
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: input.reviewNotes ?? record.reviewNotes,
      rejectionReason: reason,
      retryCount: record.retryCount + 1,
      updatedAt: now,
    };

    return this.kycRepo.update(updated);
  }
}
