import type { VerificationType, DocumentType, RiskLevel, KYCBusinessInfo } from '@ubuntu-fund/types'

export interface PaymentProvider {
  id: string
  name: string
  slug: string
  type: 'mobile_money' | 'card' | 'bank' | 'crypto' | 'wallet' | 'gateway'
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
  /** Net GHS raised: GHS donations minus provider refunds. */
  totalRaised: number
  /** Net raised per currency (after refunds); never summed across currencies. */
  totalRaisedByCurrency?: Record<string, number>
  activeCampaigns: number
  totalUsers: number
  /** Pending supporter reports about campaigns (API name kept for compatibility). */
  pendingDisputes: number
  totalDonations: number
  avgDonation: number
  conversionRate: number
  monthlyGrowth: number
}

export interface KYCVerification {
  reviewVersion: string
  informationRequests?: Array<{ id: string; prompt: string; requestedAt: string; response?: string; respondedAt?: string }>
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
