import {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
  PaymentMethod,
  VerificationLevel,
  UserRole,
  AiWritingAction,
  KYCStatus,
  KYCLevel,
  type VerificationType,
  type DocumentType,
  type RiskLevel,
} from '@ubuntu-fund/types'
import type { Campaign, User, Donation, AiUsageStats, AiUsageLogEntry } from '@ubuntu-fund/types'

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

export interface ActivityItem {
  id: string
  type: 'donation' | 'campaign_created' | 'user_joined' | 'dispute_opened' | 'campaign_funded'
  message: string
  timestamp: Date
}

export interface AiUsageMockData {
  aiUsageStats: AiUsageStats
  aiUsageLog: AiUsageLogEntry[]
}

const names = [
  'Amara Okafor', 'Kwame Mensah', 'Fatima Diallo', 'Tendai Moyo',
  'Zainab Hassan', 'Kofi Asante', 'Nala Kamara', 'Sipho Ndlovu',
  'Aisha Mohammed', 'Emeka Uche', 'Wanjiku Njoroge', 'Ousmane Ba',
  'Chiamaka Eze', 'Binta Toure', 'Jelani Osei',
]

const campaignTitles = [
  'Build a School in Kumasi', 'Medical Fund for Aisha', 'Clean Water for Kibera',
  'Support Local Farmers in Senegal', 'Emergency Relief - Flood Victims',
  'Youth Tech Training Lagos', 'Solar Power for Rural Clinic',
  'Women Entrepreneurs Accra', 'Community Library Nairobi',
  'Scholarship Fund for Girls', 'Mobile Health Unit - Niger Delta',
  'Fish Farm Cooperative Mombasa', 'Art Center for Youth Johannesburg',
  'Drought Relief East Africa', 'Microfinance for Market Women',
]

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateUsers(count: number): User[] {
  const roles = [UserRole.USER, UserRole.USER, UserRole.USER, UserRole.ORGANIZATION, UserRole.ADMIN]
  const countries = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Senegal', 'Tanzania', 'Ethiopia', 'Uganda']
  const levels = [VerificationLevel.NONE, VerificationLevel.EMAIL_PHONE, VerificationLevel.NATIONAL_ID, VerificationLevel.INSTITUTIONAL, VerificationLevel.COMMUNITY]
  const kycStatuses = [KYCStatus.UNVERIFIED, KYCStatus.PENDING, KYCStatus.VERIFIED, KYCStatus.REJECTED, KYCStatus.EXPIRED]
  const kycLevels = [KYCLevel.NONE, KYCLevel.BASIC, KYCLevel.FULL, KYCLevel.BUSINESS]

  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i + 1}`,
    email: `${names[i % names.length].toLowerCase().replace(' ', '.')}@email.com`,
    name: names[i % names.length],
    avatarUrl: undefined,
    role: randomItem(roles),
    verificationLevel: randomItem(levels),
    trustScore: Math.floor(Math.random() * 100),
    country: randomItem(countries),
    kycStatus: randomItem(kycStatuses),
    kycVerifiedAt: Math.random() > 0.5 ? randomDate(new Date(2024, 0, 1), new Date(2026, 2, 1)) : undefined,
    kycLevel: randomItem(kycLevels),
    createdAt: randomDate(new Date(2024, 0, 1), new Date(2026, 2, 1)),
    updatedAt: new Date(),
  }))
}

function generateCampaigns(count: number, users: User[]): Campaign[] {
  const statuses = [CampaignStatus.ACTIVE, CampaignStatus.ACTIVE, CampaignStatus.PENDING_REVIEW, CampaignStatus.FUNDED, CampaignStatus.EXPIRED, CampaignStatus.BLOCKED, CampaignStatus.DRAFT]
  const categories = Object.values(CampaignCategory)
  const priorities = [CampaignPriority.NORMAL, CampaignPriority.NORMAL, CampaignPriority.URGENT, CampaignPriority.CRITICAL]

  return Array.from({ length: count }, (_, i) => {
    const goal = Math.floor(Math.random() * 50000) + 1000
    const raised = Math.floor(Math.random() * goal * 1.2)
    const start = randomDate(new Date(2025, 0, 1), new Date(2026, 1, 1))
    const end = new Date(start.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000)

    return {
      id: `campaign-${i + 1}`,
      title: campaignTitles[i % campaignTitles.length],
      description: `This campaign aims to make a real difference in the community. We need your support to reach our goal and create lasting impact across the region.`,
      goalAmount: goal,
      raisedAmount: Math.min(raised, goal),
      currency: 'USD',
      category: randomItem(categories),
      priority: randomItem(priorities),
      status: randomItem(statuses),
      creatorId: randomItem(users).id,
      beneficiaries: [],
      imageUrls: [],
      startDate: start,
      endDate: end,
      createdAt: start,
      updatedAt: new Date(),
    }
  })
}

const paymentMethods = Object.values(PaymentMethod)

function generateDonations(count: number, campaigns: Campaign[], users: User[]): Donation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `donation-${i + 1}`,
    campaignId: randomItem(campaigns).id,
    donorId: randomItem(users).id,
    amount: Math.floor(Math.random() * 500) + 5,
    currency: 'USD',
    paymentMethod: randomItem(paymentMethods),
    message: Math.random() > 0.5 ? 'Keep up the great work!' : undefined,
    isAnonymous: Math.random() > 0.8,
    createdAt: randomDate(new Date(2025, 6, 1), new Date(2026, 2, 29)),
  }))
}

function generateDisputes(count: number, campaigns: Campaign[], users: User[]): Dispute[] {
  const reasons = [
    'Suspected fraudulent campaign', 'Funds misuse reported',
    'Campaign creator unresponsive', 'Misleading campaign description',
    'Duplicate campaign detected', 'Identity verification failed',
  ]
  const statuses: Dispute['status'][] = ['open', 'under_review', 'resolved']

  return Array.from({ length: count }, (_, i) => {
    const campaign = randomItem(campaigns)
    const reporter = randomItem(users)
    const status = randomItem(statuses)
    return {
      id: `dispute-${i + 1}`,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      reporterId: reporter.id,
      reporterName: reporter.name,
      assigneeId: status !== 'open' ? 'user-1' : undefined,
      assigneeName: status !== 'open' ? 'Admin User' : undefined,
      reason: randomItem(reasons),
      status,
      resolution: status === 'resolved' ? 'Investigation complete. Action taken.' : undefined,
      createdAt: randomDate(new Date(2025, 9, 1), new Date(2026, 2, 20)),
      updatedAt: new Date(),
    }
  })
}

function generateStats(campaigns: Campaign[], donations: Donation[], users: User[], disputes: Dispute[]): PlatformStats {
  const totalRaised = donations.reduce((sum, d) => sum + d.amount, 0)
  return {
    totalRaised,
    activeCampaigns: campaigns.filter(c => c.status === CampaignStatus.ACTIVE).length,
    totalUsers: users.length,
    pendingDisputes: disputes.filter(d => d.status === 'open').length,
    totalDonations: donations.length,
    avgDonation: Math.round(totalRaised / donations.length),
    conversionRate: 12.4,
    monthlyGrowth: 8.3,
  }
}

function generateAiUsageLog(count: number): AiUsageLogEntry[] {
  const actions = Object.values(AiWritingAction)
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000)
    const inputLength = Math.floor(Math.random() * 800) + 50
    const outputLength = Math.floor(Math.random() * 600) + 40
    return {
      id: `ai-${i + 1}`,
      action: actions[Math.floor(Math.random() * actions.length)],
      timestamp,
      inputLength,
      outputLength,
      status: Math.random() > 0.9 ? 'error' : 'success',
    }
  })
}

function generateActivity(): ActivityItem[] {
  return [
    { id: 'a1', type: 'donation', message: 'Kwame Mensah donated $250 to "Build a School in Kumasi"', timestamp: new Date(2026, 2, 29, 14, 30) },
    { id: 'a2', type: 'campaign_created', message: 'Fatima Diallo created "Clean Water for Kibera"', timestamp: new Date(2026, 2, 29, 13, 15) },
    { id: 'a3', type: 'user_joined', message: 'Nala Kamara joined the platform', timestamp: new Date(2026, 2, 29, 12, 0) },
    { id: 'a4', type: 'campaign_funded', message: '"Solar Power for Rural Clinic" reached its goal!', timestamp: new Date(2026, 2, 29, 11, 45) },
    { id: 'a5', type: 'dispute_opened', message: 'Dispute opened for "Emergency Relief - Flood Victims"', timestamp: new Date(2026, 2, 29, 10, 20) },
    { id: 'a6', type: 'donation', message: 'Anonymous donated $1,000 to "Scholarship Fund for Girls"', timestamp: new Date(2026, 2, 29, 9, 10) },
    { id: 'a7', type: 'user_joined', message: 'Emeka Uche joined the platform', timestamp: new Date(2026, 2, 28, 22, 0) },
    { id: 'a8', type: 'donation', message: 'Zainab Hassan donated $75 to "Youth Tech Training Lagos"', timestamp: new Date(2026, 2, 28, 20, 15) },
  ]
}

export function generateDonationTrend(): { month: string; amount: number }[] {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
  let base = 15000
  return months.map(month => {
    base += Math.floor(Math.random() * 8000) - 2000
    if (base < 5000) base = 5000
    return { month, amount: base }
  })
}

export function generateCategoryBreakdown(): { category: string; value: number }[] {
  return [
    { category: 'Medical', value: 32 },
    { category: 'Education', value: 25 },
    { category: 'Emergency', value: 15 },
    { category: 'Business', value: 12 },
    { category: 'Community', value: 9 },
    { category: 'Creative', value: 4 },
    { category: 'Religious', value: 3 },
  ]
}

export function generateGeographicData(): { country: string; campaigns: number; donations: number }[] {
  return [
    { country: 'Nigeria', campaigns: 142, donations: 28500 },
    { country: 'Kenya', campaigns: 98, donations: 21200 },
    { country: 'Ghana', campaigns: 76, donations: 15800 },
    { country: 'South Africa', campaigns: 65, donations: 19400 },
    { country: 'Senegal', campaigns: 43, donations: 8900 },
    { country: 'Tanzania', campaigns: 38, donations: 7600 },
    { country: 'Ethiopia', campaigns: 31, donations: 6200 },
    { country: 'Uganda', campaigns: 27, donations: 5100 },
  ]
}

export function generateFraudMetrics(): { metric: string; value: number; change: number }[] {
  return [
    { metric: 'Flagged Campaigns', value: 23, change: -12 },
    { metric: 'Blocked Users', value: 8, change: 3 },
    { metric: 'Fraud Rate', value: 1.2, change: -0.3 },
    { metric: 'Avg Resolution Time', value: 2.4, change: -0.5 },
  ]
}

let _users: User[] | null = null
let _campaigns: Campaign[] | null = null
let _donations: Donation[] | null = null
let _disputes: Dispute[] | null = null

function getUsers() {
  if (!_users) _users = generateUsers(50)
  return _users
}
function getCampaigns() {
  if (!_campaigns) _campaigns = generateCampaigns(30, getUsers())
  return _campaigns
}
function getDonations() {
  if (!_donations) _donations = generateDonations(200, getCampaigns(), getUsers())
  return _donations
}
function getDisputes() {
  if (!_disputes) _disputes = generateDisputes(15, getCampaigns(), getUsers())
  return _disputes
}

function generateKYCVerifications(count: number, users: User[]): KYCVerification[] {
  const types: VerificationType[] = ['identity', 'address', 'business', 'political', 'media']
  const statuses: KYCVerification['status'][] = ['pending', 'in_review', 'approved', 'rejected', 'expired']
  const docTypes: DocumentType[] = ['id_card', 'passport', 'drivers_license', 'utility_bill', 'bank_statement', 'business_registration', 'tax_certificate']
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high']

  return Array.from({ length: count }, (_, i) => {
    const user = randomItem(users)
    const type = randomItem(types)
    const status = randomItem(statuses)
    return {
      id: `kyc-${i + 1}`,
      userId: user.id,
      userName: user.name,
      verificationType: type,
      status,
      documents: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => ({
        type: randomItem(docTypes),
        url: `https://example.com/doc-${i}-${j}.pdf`,
        uploadedAt: randomDate(new Date(2025, 9, 1), new Date(2026, 2, 20)),
        verifiedAt: status === 'approved' ? randomDate(new Date(2025, 9, 1), new Date(2026, 2, 20)) : undefined,
      })),
      personalInfo: type === 'identity' || type === 'address' ? {
        fullName: user.name,
        dateOfBirth: randomDate(new Date(1970, 0, 1), new Date(2005, 0, 1)),
        nationality: user.country,
        idNumber: `ID-${Math.floor(Math.random() * 1000000)}`,
        address: {
          street: `${Math.floor(Math.random() * 1000)} Main St`,
          city: randomItem(['Lagos', 'Accra', 'Nairobi', 'Johannesburg', 'Dakar']),
          state: randomItem(['Lagos', 'Greater Accra', 'Nairobi County', 'Gauteng', 'Dakar Region']),
          country: user.country,
          postalCode: String(Math.floor(Math.random() * 90000) + 10000),
        },
      } : undefined,
      businessInfo: type === 'business' ? {
        businessName: `${user.name} Enterprises`,
        registrationNumber: `REG-${Math.floor(Math.random() * 1000000)}`,
        taxId: `TAX-${Math.floor(Math.random() * 1000000)}`,
        businessType: randomItem(['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship']),
        incorporationDate: randomDate(new Date(2000, 0, 1), new Date(2023, 0, 1)),
      } : undefined,
      riskLevel: randomItem(riskLevels),
      reviewedBy: status !== 'pending' ? 'admin-1' : undefined,
      reviewedAt: status !== 'pending' ? randomDate(new Date(2025, 9, 1), new Date(2026, 2, 20)) : undefined,
      reviewNotes: status === 'rejected' ? 'Documents unclear or incomplete' : undefined,
      expiryDate: status === 'approved' ? randomDate(new Date(2026, 3, 1), new Date(2027, 3, 1)) : undefined,
      rejectionReason: status === 'rejected' ? 'Documents do not match' : undefined,
      retryCount: Math.floor(Math.random() * 3),
      createdAt: randomDate(new Date(2025, 9, 1), new Date(2026, 2, 20)),
      updatedAt: new Date(),
    }
  })
}

let _kycVerifications: KYCVerification[] | null = null

function getKYCVerifications() {
  if (!_kycVerifications) _kycVerifications = generateKYCVerifications(25, getUsers())
  return _kycVerifications
}

export function useMockData() {
  const users = getUsers()
  const campaigns = getCampaigns()
  const donations = getDonations()
  const disputes = getDisputes()
  const kycVerifications = getKYCVerifications()
  const stats = generateStats(campaigns, donations, users, disputes)
  const activity = generateActivity()
  const donationTrend = generateDonationTrend()
  const aiUsageLog = generateAiUsageLog(20)
  const aiUsageStats: AiUsageStats = {
    userId: 'admin-1',
    totalRequests: 47,
    requestsToday: 3,
    requestsThisMonth: 23,
    lastUsedAt: new Date(),
  }
  const paymentProviders: PaymentProvider[] = [
    { id: '1', name: 'UbuntuFund Wallet', slug: 'wallet', type: 'wallet', enabled: true, isDefault: true, feePercent: 0, displayOrder: 1, createdAt: new Date() },
    { id: '2', name: 'M-Pesa', slug: 'mpesa', type: 'mobile_money', enabled: false, isDefault: false, feePercent: 1.5, displayOrder: 2, createdAt: new Date() },
    { id: '3', name: 'MTN MoMo', slug: 'mtn-momo', type: 'mobile_money', enabled: false, isDefault: false, feePercent: 1.5, displayOrder: 3, createdAt: new Date() },
    { id: '4', name: 'Stripe', slug: 'stripe', type: 'card', enabled: false, isDefault: false, feePercent: 2.9, displayOrder: 4, createdAt: new Date() },
    { id: '5', name: 'Paystack', slug: 'paystack', type: 'bank', enabled: false, isDefault: false, feePercent: 1.5, displayOrder: 5, createdAt: new Date() },
    { id: '6', name: 'Flutterwave', slug: 'flutterwave', type: 'bank', enabled: false, isDefault: false, feePercent: 1.4, displayOrder: 6, createdAt: new Date() },
    { id: '7', name: 'Bitcoin', slug: 'bitcoin', type: 'crypto', enabled: false, isDefault: false, feePercent: 1.0, displayOrder: 7, createdAt: new Date() },
  ]

  return {
    users,
    campaigns,
    donations,
    disputes,
    kycVerifications,
    stats,
    activity,
    donationTrend,
    paymentProviders,
    aiUsageStats,
    aiUsageLog,
  }
}

export function useMockUser(id: string): User | undefined {
  return getUsers().find(u => u.id === id)
}

export function useMockCampaign(id: string): Campaign | undefined {
  return getCampaigns().find(c => c.id === id)
}

export function useMockCampaignDonations(campaignId: string): Donation[] {
  return getDonations().filter(d => d.campaignId === campaignId)
}

export function useMockUserCampaigns(userId: string): Campaign[] {
  return getCampaigns().filter(c => c.creatorId === userId)
}

export function useMockUserDonations(userId: string): Donation[] {
  return getDonations().filter(d => d.donorId === userId)
}
