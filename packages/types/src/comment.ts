export interface CampaignComment {
  id: string
  campaignId: string
  authorId: string
  authorName: string
  authorAvatarUrl?: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateCampaignCommentInput {
  content: string
}
