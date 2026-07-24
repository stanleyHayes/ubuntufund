export enum CampaignStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  FUNDED = 'funded',
  EXPIRED = 'expired',
  BLOCKED = 'blocked',
}

export enum CampaignCategory {
  MEDICAL = 'medical',
  EDUCATION = 'education',
  EMERGENCY = 'emergency',
  BUSINESS = 'business',
  COMMUNITY = 'community',
  RELIGIOUS = 'religious',
  CREATIVE = 'creative',
}

export enum CampaignPriority {
  NORMAL = 'normal',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export interface Campaign {
  id: string
  title: string
  description: string
  goalAmount: number
  raisedAmount: number
  currency: string
  category: CampaignCategory
  priority: CampaignPriority
  status: CampaignStatus
  creatorId: string
  beneficiaries: string[]
  imageUrls: string[]
  startDate: Date
  endDate: Date
  createdAt: Date
  updatedAt: Date
  /** Number of distinct donors; present on list/detail reads. */
  donorCount?: number
  reviewNotes?: string
  reviewedBy?: string
  reviewedAt?: Date
}

export interface CreateCampaignInput {
  title: string
  description: string
  goalAmount: number
  currency: string
  category: CampaignCategory
  priority: CampaignPriority
  beneficiaries: string[]
  endDate: Date
}

/** Campaign with donation details, returned by the get-by-id endpoint */
export interface CampaignDetail extends Campaign {
  donations: CampaignDonation[]
  donorCount: number
}

export interface UpdateCampaignInput {
  title?: string
  description?: string
  goalAmount?: number
  category?: CampaignCategory
  priority?: CampaignPriority
  beneficiaries?: string[]
  endDate?: Date
}

export enum PaymentMethod {
  WALLET = 'wallet',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto',
}

export interface Donation {
  id: string
  campaignId: string
  donorId: string
  amount: number
  currency: string
  paymentMethod: PaymentMethod
  message?: string
  isAnonymous: boolean
  createdAt: Date
}

/** Donation with donor info, used in campaign detail responses */
export interface CampaignDonation {
  id: string
  donorName: string
  donorAvatarUrl?: string
  amount: number
  currency: string
  paymentMethod: PaymentMethod
  message?: string
  isAnonymous: boolean
  createdAt: Date
}

export interface CreateDonationInput {
  campaignId: string
  amount: number
  currency: string
  paymentMethod: PaymentMethod
  message?: string
  isAnonymous: boolean
  phoneNumber?: string
}

export type CampaignUpdateType = 'milestone' | 'general' | 'thank_you' | 'urgent'

export interface CampaignUpdate {
  id: string
  campaignId: string
  authorId: string
  title: string
  content: string
  type: CampaignUpdateType
  mediaUrls: string[]
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateCampaignUpdateInput {
  title: string
  content: string
  type: CampaignUpdateType
  mediaUrls?: string[]
  isPinned?: boolean
}

export interface UpdateCampaignUpdateInput {
  title?: string
  content?: string
  type?: CampaignUpdateType
  mediaUrls?: string[]
}
