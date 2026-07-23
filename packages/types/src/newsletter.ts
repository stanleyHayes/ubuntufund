export interface NewsletterSubscriber {
  id: string
  email: string
  status: 'active' | 'unsubscribed'
  subscribedAt: Date
  unsubscribedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SubscribeNewsletterInput {
  email: string
}
