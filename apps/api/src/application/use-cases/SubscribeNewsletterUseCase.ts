import type { NewsletterConsentService } from '../services/NewsletterConsentService.js';
import { Email } from '../../domain/value-objects/Email.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface SubscribeNewsletterInput {
  email: string;
  consent: true;
}

export interface SubscribeNewsletterResultDTO {
  message: string;
}

export class SubscribeNewsletterUseCase {
  constructor(
    private readonly consent: NewsletterConsentService
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

    if (input.consent !== true) throw new AppError('Confirm that you want newsletter emails.', 400);
    await this.consent.request(email, 'public');

    return {
      message: 'Check your email to confirm your request. If you are already subscribed, your preference stays unchanged.',
    };
  }
}
