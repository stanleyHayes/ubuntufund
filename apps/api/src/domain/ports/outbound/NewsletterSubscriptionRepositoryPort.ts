export interface NewsletterSubscriptionRecord {
  id: string;
  email: string;
  createdAt: Date;
}

export interface NewsletterSubscriptionRepositoryPort {
  /**
   * Idempotently records a newsletter subscription. Re-subscribing with an
   * already-registered email returns the existing record (unchanged
   * `createdAt`) rather than creating a duplicate — enforced by the unique
   * index on `email`.
   */
  upsertByEmail(email: string): Promise<NewsletterSubscriptionRecord>;

  /**
   * Lists every newsletter subscription, newest-first (by `createdAt`), for the
   * admin console. Read-only — the caller is expected to be an authenticated
   * admin.
   */
  listAll(): Promise<NewsletterSubscriptionRecord[]>;
}
