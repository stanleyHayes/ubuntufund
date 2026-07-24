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

export type DocumentType = 'id_card' | 'passport' | 'drivers_license' | 'utility_bill' | 'bank_statement' | 'business_registration' | 'tax_certificate'

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
  businessName?: string
  registrationNumber?: string
  taxId?: string
  businessType?: string
  incorporationDate?: Date
}

export interface KYCVerification {
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
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserInput {
  email: string
  password: string
  name: string
  /** Country — defaults to 'Ghana'; the platform operates in Ghana only */
  country?: string
  role?: UserRole
  /** Organization-specific fields */
  organizationName?: string
  organizationType?: OrganizationType
  registrationNumber?: string
  website?: string
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
