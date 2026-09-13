import { VerificationLevel, adultBirthDateError } from '@ubuntu-fund/types';
import type { VerificationType } from '@ubuntu-fund/types';
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
const VERIFICATION_LEVEL_BY_TYPE: Partial<Record<VerificationType, VerificationLevel>> =
  {
    identity: VerificationLevel.NATIONAL_ID,
    business: VerificationLevel.INSTITUTIONAL,
    political: VerificationLevel.COMMUNITY,
    media: VerificationLevel.COMMUNITY,
  };

const APPROVAL_VALIDITY_DAYS = 365;

export interface ApproveKYCInput {
  evidenceReviewed?: boolean;
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

    if (input.evidenceReviewed !== true || !input.reviewNotes?.trim() || input.reviewNotes.trim().length < 20) {
      throw new AppError('Confirm the evidence review and record findings of at least 20 characters before approval.', 422);
    }
    const now = new Date();
    if (record.verificationType === 'identity') {
      const error = adultBirthDateError(record.personalInfo?.dateOfBirth, now);
      if (error) throw new AppError(`Identity approval requires a valid adult date of birth. ${error}`, 422);
      if (!record.personalInfo?.fullName?.trim()) throw new AppError('Identity approval requires the applicant full name. Request the missing identity information.', 422);
      if (!record.documents.some(document => ['id_card', 'passport', 'drivers_license'].includes(document.type))) {
        throw new AppError('Identity approval requires an identity document. A selfie or address proof is not an identity document.', 422);
      }
    }
    if (record.verificationType === 'address') {
      const address = record.personalInfo?.address;
      const gps = address?.proofMethod === 'ghana_post_gps' && address.country === 'Ghana' && /^[A-Z]{2}-[0-9]{3,5}-[0-9]{4}$/.test(address.gpsAddress?.trim().toUpperCase() ?? '');
      const document = address?.proofMethod === 'document' && !!address.street?.trim() && record.documents.some(item => ['utility_bill', 'bank_statement'].includes(item.type));
      if (!address?.country?.trim() || !address.city?.trim() || (!gps && !document)) {
        throw new AppError('Address approval requires a country, city and valid GhanaPost GPS address or street address with private address-proof evidence.', 422);
      }
    }
    if (record.verificationType === 'business') {
      const business = record.businessInfo;
      const representative = record.personalInfo;
      const address = business?.registeredAddress;
      if (user.role !== 'organization') throw new AppError('Organization approval requires an active organization account.', 422);
      if (!business?.businessName?.trim() || !business.registrationNumber?.trim() || !business.businessType?.trim() || !record.documents.some(item => item.type === 'business_registration')) {
        throw new AppError('Organization approval requires its legal name, type, registration number and private registration evidence.', 422);
      }
      if (!address?.street?.trim() || !address.city?.trim() || !address.country?.trim()) {
        throw new AppError('Organization approval requires its registered street address, city and country.', 422);
      }
      if (!representative?.fullName?.trim() || !representative.nationality?.trim() || !representative.idNumber?.trim() || adultBirthDateError(representative.dateOfBirth, now)
        || !business.representativeCapacity?.trim() || !record.documents.some(item => item.type === 'authorization_letter')
        || !record.documents.some(item => ['id_card', 'passport', 'drivers_license'].includes(item.type))) {
        throw new AppError('Organization approval requires an adult representative identity, capacity and private identity and authorization evidence.', 422);
      }
      if (!business.controlPersons?.length || business.controlPersons.some(person => !person.fullName?.trim() || !person.country?.trim()
        || !['director', 'trustee', 'beneficial_owner', 'other_controller'].includes(person.role)
        || (person.ownershipPercent !== undefined && (!Number.isFinite(person.ownershipPercent) || person.ownershipPercent < 0 || person.ownershipPercent > 100)))
        || (business.ownershipExplanation?.trim().length ?? 0) < 20) {
        throw new AppError('Organization approval requires complete declared controlling persons and an ownership/control explanation.', 422);
      }
      const acceptedAt = business.declaration?.acceptedAt ? new Date(business.declaration.acceptedAt) : undefined;
      if (business.declaration?.authorized !== true || business.declaration.accurate !== true || !acceptedAt || !Number.isFinite(acceptedAt.getTime()) || acceptedAt > now) {
        throw new AppError('Organization approval requires recorded applicant authority and accuracy declarations. Request a corrected submission if they are missing.', 422);
      }
    }
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + APPROVAL_VALIDITY_DAYS);

    const updated: KYCVerificationRecord = {
      ...record,
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: input.reviewNotes.trim(),
      expiryDate,
      updatedAt: now,
    };

    const saved = await this.kycRepo.update(updated);

    // Address proof alone must not confer National ID privileges.
    const targetLevel = VERIFICATION_LEVEL_BY_TYPE[record.verificationType];
    if (targetLevel !== undefined && !(await this.userRepo.raiseVerificationLevel(record.userId, targetLevel))) {
      throw new AppError('Applicant account is unavailable.', 409);
    }

    return saved;
  }
}
