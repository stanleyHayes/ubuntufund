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

/**
 * A single row from the admin `GET /newsletter/subscribers` endpoint. This is
 * the JSON wire shape (dates arrive as ISO strings), leaner than the full
 * `NewsletterSubscriber` record.
 */
export interface NewsletterSubscriberSummary {
  id: string
  email: string
  createdAt: string
}
