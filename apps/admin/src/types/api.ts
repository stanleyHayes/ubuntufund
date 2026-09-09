import type { VerificationType, DocumentType, RiskLevel } from '@ubuntu-fund/types'

export interface PaymentProvider {
  id: string
  name: string
  slug: string
  type: 'mobile_money' | 'card' | 'bank' | 'crypto' | 'wallet'
  enabled: boolean
  isDefault: boolean
  feePercent: number
  displayOrder: number
  createdAt: Date
}

export interface Dispute {
  id: string
  campaignId: string
  campaignTitle: string
  reporterId: string
  reporterName: string
  assigneeId?: string
  assigneeName?: string
  reason: string
  status: 'open' | 'under_review' | 'resolved'
  resolution?: string
  createdAt: Date
  updatedAt: Date
}

export interface PlatformStats {
  totalRaised: number
  activeCampaigns: number
  totalUsers: number
  pendingDisputes: number
  totalDonations: number
  avgDonation: number
  conversionRate: number
  monthlyGrowth: number
}

export interface KYCVerification {
  id: string
  userId: string
  userName: string
  verificationType: VerificationType
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired'
  documents: Array<{
    type: DocumentType
    url: string
    uploadedAt: Date
    verifiedAt?: Date
  }>
  personalInfo?: {
    fullName?: string
    dateOfBirth?: Date
    nationality?: string
    idNumber?: string
    address?: {
      street?: string
      city?: string
      state?: string
      country?: string
      proofMethod?: 'ghana_post_gps' | 'document'
      gpsAddress?: string
      postalCode?: string
    }
  }
  businessInfo?: {
    businessName?: string
    registrationNumber?: string
    taxId?: string
    businessType?: string
    incorporationDate?: Date
  }
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
