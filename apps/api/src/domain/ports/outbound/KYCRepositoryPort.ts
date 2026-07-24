import type { VerificationType, KYCVerification } from '@ubuntu-fund/types';

/** A single KYC verification submission and its review lifecycle. */
export type KYCVerificationRecord = KYCVerification;

/** Narrowed alias for the verification's review status, reused by the persistence model. */
export type KYCVerificationStatus = KYCVerification['status'];

export interface KYCRepositoryPort {
  save(record: KYCVerificationRecord): Promise<KYCVerificationRecord>;
  findById(id: string): Promise<KYCVerificationRecord | null>;
  findByUserId(userId: string): Promise<KYCVerificationRecord[]>;
  /**
   * Existing pending/in_review submission of this type for the user. Used to
   * block duplicate submissions while a review is already in flight.
   */
  findActiveByUserIdAndType(
    userId: string,
    verificationType: VerificationType
  ): Promise<KYCVerificationRecord | null>;
  /** All submissions awaiting admin review, oldest first. */
  findPending(): Promise<KYCVerificationRecord[]>;
  update(record: KYCVerificationRecord): Promise<KYCVerificationRecord>;
}
