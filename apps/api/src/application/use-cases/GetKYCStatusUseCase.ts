import { KYCStatus, KYCLevel, type KYCInformationExchange } from '@ubuntu-fund/types';
import type { KYCRepositoryPort } from '../../domain/ports/outbound/KYCRepositoryPort.js';
import { isCurrentApproval, latestKycByType } from '../../domain/services/currentKycEvidence.js';

interface KYCStatusVerificationDTO {
  rejectionReason?: string;
  informationRequests?: KYCInformationExchange[];
  id: string;
  type: string;
  status: string;
  riskLevel?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface KYCStatusDTO {
  kycStatus: KYCStatus;
  kycLevel: KYCLevel;
  verifications: KYCStatusVerificationDTO[];
}

export class GetKYCStatusUseCase {
  constructor(private readonly kycRepo: KYCRepositoryPort) {}

  async execute(userId: string): Promise<KYCStatusDTO> {
    const now = new Date();
    const stored = await this.kycRepo.findByUserId(userId);
    // Derive current display state without rewriting the historical decision.
    // An approval without a finite, future expiry (expired, or a legacy row
    // that never recorded one) is not current here either, so this status
    // agrees with the verification level, allowance and payout checks.
    const records = stored.map(record => record.status === 'approved' && !isCurrentApproval(record, now)
      ? { ...record, status: 'expired' as const } : record);

    // Aggregate only the newest submission of each type. Older decisions stay
    // in the history but cannot override a renewal awaiting review or rejected.
    const current = [...latestKycByType(records).values()];

    const approvedTypes = new Set(
      current
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
    if (current.length > 0) {
      if (current.some((r) => r.status === 'approved')) {
        kycStatus = KYCStatus.VERIFIED;
      } else if (
        current.some((r) => r.status === 'pending' || r.status === 'in_review')
      ) {
        kycStatus = KYCStatus.PENDING;
      } else if (current.every((r) => r.status === 'expired')) {
        kycStatus = KYCStatus.EXPIRED;
      } else {
        kycStatus = KYCStatus.REJECTED;
      }
    }

    const verifications: KYCStatusVerificationDTO[] = records.map((r) => ({
      id: r.id,
      informationRequests: r.informationRequests,
      type: r.verificationType,
      status: r.status,
      rejectionReason: r.status === 'rejected' ? r.rejectionReason : undefined,
      riskLevel: r.riskLevel,
      createdAt: r.createdAt,
      expiresAt: r.expiryDate,
    }));

    return { kycStatus, kycLevel, verifications };
  }
}
