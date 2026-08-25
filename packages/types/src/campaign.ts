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
  /**
   * URL-safe vanity handle, unique and lowercase. Auto-generated (kebab-case)
   * from the title on create; the owner/admin can override it. Drives the
   * public `/c/:slug` route and short-link targets.
   */
  slug?: string
  title: string
  description: string
  goalAmount: number
  raisedAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
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

/**
 * Denormalized social-preview block returned alongside the public campaign
 * DTO by `GET /campaigns/slug/:slug/public`. Everything a share card or
 * OpenGraph/Twitter meta tag needs, with no donor/payment data.
 */
export interface CampaignSocialPreview {
  title: string
  /** Short plain-text blurb derived from the description. */
  summary: string
  imageUrl?: string
  raisedAmount: number
  goalAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
  currency: string
  /** Absolute canonical URL, `${PUBLIC_WEB_URL}/c/${slug}`. */
  canonicalUrl: string
}

/**
 * Public campaign view resolved by slug: the same shape as the get-by-id
 * public DTO, plus a `socialPreview` block for share cards / meta tags.
 */
export interface CampaignPublicView extends Campaign {
  socialPreview: CampaignSocialPreview
}

/** Body for `PATCH /campaigns/:id/slug`. */
export interface SetCampaignSlugInput {
  slug: string
}

export interface CreateCampaignInput {
  title: string
  description: string
  goalAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
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
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
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
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
  currency: string
  paymentMethod: PaymentMethod
  message?: string
  isAnonymous: boolean
  createdAt: Date
}

export interface CreateDonationInput {
  campaignId: string
  amount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
  currency: string
  paymentMethod: PaymentMethod
  message?: string
  isAnonymous: boolean
  phoneNumber?: string
  /**
   * When set, attributes this donation to a live session so it drives that
   * session's overlay stats and real-time events.
   */
  liveSessionId?: string
  /**
   * Coarse attribution source token (e.g. a QR/utm source). Never PII;
   * reserved for later attribution reporting.
   */
  attributionSource?: string
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
