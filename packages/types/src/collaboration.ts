export enum CollaborationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  REMOVED = 'removed',
}

export enum CollaboratorRole {
  /** Full co-owner: can edit campaign, view donations, manage collaborators */
  CO_OWNER = 'co_owner',
  /** Can edit campaign content but not manage collaborators or view financials */
  EDITOR = 'editor',
  /** Featured on campaign page with branding, no edit access */
  FEATURED_PARTNER = 'featured_partner',
}

export interface CampaignCollaborator {
  id: string
  campaignId: string
  /** The user/org being invited to collaborate */
  userId: string
  /** The user/org who sent the invitation */
  invitedBy: string
  role: CollaboratorRole
  status: CollaborationStatus
  /** Revenue share percentage (0-100) for this collaborator */
  revenueSharePercent: number
  /** Display name on the campaign page */
  displayName: string
  /** Optional logo/avatar URL for the collaborator */
  logoUrl?: string
  /** Optional message from the inviter */
  inviteMessage?: string
  respondedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface InviteCollaboratorInput {
  campaignId: string
  userId: string
  role: CollaboratorRole
  revenueSharePercent: number
  inviteMessage?: string
}

export interface RespondToCollaborationInput {
  collaborationId: string
  accept: boolean
  declineReason?: string
}

export interface UpdateCollaboratorInput {
  role?: CollaboratorRole
  revenueSharePercent?: number
}

/** Summary of collaboration on a campaign, shown on campaign detail */
export interface CampaignCollaborationSummary {
  campaignId: string
  collaborators: {
    userId: string
    displayName: string
    logoUrl?: string
    role: CollaboratorRole
    revenueSharePercent: number
  }[]
  totalCollaborators: number
  /** Whether the campaign is a collaborative (multi-party) campaign */
  isCollaborative: boolean
}
