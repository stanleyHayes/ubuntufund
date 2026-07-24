import type { NewsletterSubscriptionRepositoryPort } from '../../domain/ports/outbound/NewsletterSubscriptionRepositoryPort.js';

/** A single newsletter subscriber row for the admin console. */
export interface NewsletterSubscriberDTO {
  id: string;
  email: string;
  createdAt: Date;
}

/**
 * Admin-only: lists every newsletter subscriber, newest-first. Mirrors the
 * shape of the other admin list slices (e.g. GetPendingKYCUseCase) — a thin
 * read that delegates ordering to the repository.
 */
export class ListNewsletterSubscribersUseCase {
  constructor(
    private readonly newsletterRepo: NewsletterSubscriptionRepositoryPort
  ) {}

  async execute(): Promise<NewsletterSubscriberDTO[]> {
    const records = await this.newsletterRepo.listAll();
    return records.map((record) => ({
      id: record.id,
      email: record.email,
      createdAt: record.createdAt,
    }));
  }
}
