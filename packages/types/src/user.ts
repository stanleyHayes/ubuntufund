import type { LegalAcceptanceInput, LegalAcceptanceRecord } from './legal-acceptance'
export enum VerificationLevel {
  NONE = 0,
  EMAIL_PHONE = 1,
  NATIONAL_ID = 2,
  INSTITUTIONAL = 3,
  COMMUNITY = 4,
}

export enum UserRole {
  USER = 'user',
  ORGANIZATION = 'organization',
  ADMIN = 'admin',
}

export enum KYCStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum KYCLevel {
  NONE = 0,
  BASIC = 1,
  FULL = 2,
  BUSINESS = 3,
}

export type VerificationType = 'identity' | 'address' | 'business' | 'political' | 'media'

export const KYC_IDENTITY_DOCUMENT_OPTIONS = [
  { value: 'id_card', label: 'National ID card' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: 'Driving licence' },
] as const
export type KYCIdentityDocumentType = (typeof KYC_IDENTITY_DOCUMENT_OPTIONS)[number]['value']

export type DocumentType = 'authorization_letter' | 'ownership_register' | 'selfie' | 'id_card' | 'passport' | 'drivers_license' | 'utility_bill' | 'bank_statement' | 'business_registration' | 'tax_certificate'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface KYCDocument {
  type: DocumentType
  url: string
  uploadedAt: Date
  verifiedAt?: Date
}

export interface KYCAddress {
  street?: string
  city?: string
  state?: string
  /** Country — defaults to 'Ghana'; the platform operates in Ghana only */
  country?: string
  proofMethod?: 'ghana_post_gps' | 'document'
  gpsAddress?: string
  postalCode?: string
}

export interface KYCPersonalInfo {
  fullName?: string
  dateOfBirth?: Date
  nationality?: string
  idNumber?: string
  address?: KYCAddress
}

export interface KYCBusinessInfo {
  registeredAddress?: KYCAddress
  representativeCapacity?: string
  controlPersons?: Array<{ fullName: string; role: 'director' | 'trustee' | 'beneficial_owner' | 'other_controller'; country: string; ownershipPercent?: number }>
  ownershipExplanation?: string
  declaration?: { authorized: boolean; accurate: boolean; acceptedAt: Date }

  businessName?: string
  registrationNumber?: string
  taxId?: string
  businessType?: string
  incorporationDate?: Date
}

export interface KYCInformationExchange {
  id: string
  prompt: string
  requestedAt: Date
  response?: string
  respondedAt?: Date
}

export interface KYCVerification {
  informationRequests?: KYCInformationExchange[]
  id: string
  userId: string
  verificationType: VerificationType
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired'
  documents: KYCDocument[]
  personalInfo?: KYCPersonalInfo
  businessInfo?: KYCBusinessInfo
  riskLevel: RiskLevel
  reviewedBy?: string
  reviewedAt?: Date
  reviewNotes?: string
  expiryDate?: Date
  rejectionReason?: string
  retryCount: number
  createdAt: Date
  updatedAt: Date
}

export interface User {
  legalAcceptance?: LegalAcceptanceRecord
  needsWebsite?: boolean
  organizationName?: string
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
  verificationLevel: VerificationLevel
  trustScore: number
  /** Country — defaults to 'Ghana'; the platform operates in Ghana only */
  country?: string
  kycStatus: KYCStatus
  kycVerifiedAt?: Date
  kycLevel: KYCLevel
  /**
   * Compliance-approved campaign-goal ceiling (spec §18): the effective goal cap
   * is MIN(plan cap, this). `-1` = approved unlimited; undefined = no override.
   */
  complianceApprovedCampaignLimit?: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserInput {
  legalAcceptance?: LegalAcceptanceInput
  email: string
  password: string
  name: string
  /** Country — defaults to 'Ghana'; the platform operates in Ghana only */
  country?: string
  role?: UserRole
  /** Organization-specific fields */
  needsWebsite?: boolean
  organizationName?: string
  organizationType?: OrganizationType
  registrationNumber?: string
  website?: string
  /** Referral code (from a ?ref link) linking this signup to a referrer's affiliate. */
  referralCode?: string
}

export enum OrganizationType {
  NGO = 'ngo',
  HOSPITAL = 'hospital',
  SCHOOL = 'school',
  RELIGIOUS = 'religious',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

export interface LoginInput {
  mfaCode?: string
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}
