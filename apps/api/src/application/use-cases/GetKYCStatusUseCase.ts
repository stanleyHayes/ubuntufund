import { KYCStatus, KYCLevel } from '@ubuntu-fund/types';
import type { KYCRepositoryPort } from '../../domain/ports/outbound/KYCRepositoryPort.js';

export interface KYCStatusVerificationDTO {
  id: string;
  type: string;
  status: string;
  riskLevel?: string;
  createdAt: Date;
}

export interface KYCStatusDTO {
  kycStatus: KYCStatus;
  kycLevel: KYCLevel;
  verifications: KYCStatusVerificationDTO[];
}

export class GetKYCStatusUseCase {
  constructor(private readonly kycRepo: KYCRepositoryPort) {}

  async execute(userId: string): Promise<KYCStatusDTO> {
    const records = await this.kycRepo.findByUserId(userId);

    const approvedTypes = new Set(
      records
        .filter((r) => r.status === 'approved')
        .map((r) => r.verificationType)
    );

    let kycLevel: KYCLevel = KYCLevel.NONE;
    if (approvedTypes.has('identity') || approvedTypes.has('address')) {
      kycLevel = KYCLevel.BASIC;
    }
    if (approvedTypes.has('identity') && approvedTypes.has('address')) {
      kycLevel = KYCLevel.FULL;
    }
    if (approvedTypes.has('business')) {
      kycLevel = KYCLevel.BUSINESS;
    }

    let kycStatus: KYCStatus = KYCStatus.UNVERIFIED;
    if (records.length > 0) {
      if (records.some((r) => r.status === 'approved')) {
        kycStatus = KYCStatus.VERIFIED;
      } else if (
        records.some((r) => r.status === 'pending' || r.status === 'in_review')
      ) {
        kycStatus = KYCStatus.PENDING;
      } else if (records.every((r) => r.status === 'expired')) {
        kycStatus = KYCStatus.EXPIRED;
      } else {
        kycStatus = KYCStatus.REJECTED;
      }
    }

    const verifications: KYCStatusVerificationDTO[] = records.map((r) => ({
      id: r.id,
      type: r.verificationType,
      status: r.status,
      riskLevel: r.riskLevel,
      createdAt: r.createdAt,
    }));

    return { kycStatus, kycLevel, verifications };
  }
}
