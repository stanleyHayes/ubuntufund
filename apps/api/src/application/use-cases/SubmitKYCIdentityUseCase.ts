import type { KYCAddress, DocumentType } from '@ubuntu-fund/types';
import { adultBirthDateError } from '@ubuntu-fund/types';
import type {
  KYCRepositoryPort,
  KYCVerificationRecord,
} from '../../domain/ports/outbound/KYCRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { KYC_RENEWAL_WINDOW_DAYS, kycRenewalOpensAt } from '../../domain/services/currentKycEvidence.js';

export interface SubmitKYCIdentityInput {
  personalInfo?: {
    fullName?: string;
    /** ISO 8601 date string from the client; converted to a Date below. */
    dateOfBirth?: string;
    nationality?: string;
    idNumber?: string;
    address?: KYCAddress;
  };
  documents?: Array<{ type: DocumentType; url: string }>;
}

export class SubmitKYCIdentityUseCase {
  constructor(private readonly kycRepo: KYCRepositoryPort) {}

  async execute(
    input: SubmitKYCIdentityInput,
    userId: string
  ): Promise<KYCVerificationRecord> {
    if (input.personalInfo?.dateOfBirth !== undefined) {
      const error = adultBirthDateError(input.personalInfo.dateOfBirth);
      if (error) throw new AppError(error, 422);
    }
    const existing = await this.kycRepo.findActiveByUserIdAndType(
      userId,
      'identity'
    );
    if (existing) {
      throw new AppError(
        'You already have a pending identity verification',
        409
      );
    }
    const renewalOpensAt = kycRenewalOpensAt(await this.kycRepo.findByUserId(userId), 'identity');
    if (renewalOpensAt) {
      throw new AppError(
        `Your identity verification is current. You can renew it from ${renewalOpensAt.toISOString().slice(0, 10)}, ${KYC_RENEWAL_WINDOW_DAYS} days before it expires.`,
        409
      );
    }

    const now = new Date();

    const documents = (input.documents ?? []).map((doc) => ({
      type: doc.type,
      url: doc.url,
      uploadedAt: now,
    }));

    const personalInfo = input.personalInfo
      ? {
          fullName: input.personalInfo.fullName,
          dateOfBirth: input.personalInfo.dateOfBirth
            ? new Date(input.personalInfo.dateOfBirth)
            : undefined,
          nationality: input.personalInfo.nationality,
          idNumber: input.personalInfo.idNumber,
          address: input.personalInfo.address,
        }
      : undefined;

    const record: KYCVerificationRecord = {
      id: '', // Assigned by repository
      userId,
      verificationType: 'identity',
      status: 'pending',
      documents,
      personalInfo,
      riskLevel: 'low',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return this.kycRepo.save(record);
  }
}
