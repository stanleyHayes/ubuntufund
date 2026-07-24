import type { NewsletterSubscriptionRepositoryPort } from '../../domain/ports/outbound/NewsletterSubscriptionRepositoryPort.js';
import { Email } from '../../domain/value-objects/Email.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface SubscribeNewsletterInput {
  email: string;
}

export interface SubscribeNewsletterResultDTO {
  message: string;
}

export class SubscribeNewsletterUseCase {
  constructor(
    private readonly newsletterRepo: NewsletterSubscriptionRepositoryPort
  ) {}

  async execute(
    input: SubscribeNewsletterInput
  ): Promise<SubscribeNewsletterResultDTO> {
    let email: string;
    try {
      // The Email value object trims + lowercases and validates the address,
      // so subscribing with different casing/whitespace maps to one record.
      email = new Email(input.email ?? '').value;
    } catch {
      throw new AppError('Please enter a valid email address', 400);
    }

    // Idempotent: re-subscribing an existing address is a no-op that still
    // reports success to the caller.
    await this.newsletterRepo.upsertByEmail(email);

    return {
      message: "You're subscribed. Look out for updates from UbuntuFund.",
    };
  }
}
