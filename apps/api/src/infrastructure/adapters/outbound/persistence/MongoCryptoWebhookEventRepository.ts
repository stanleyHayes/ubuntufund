import type { CryptoWebhookEventRepositoryPort } from '../../../../domain/ports/outbound/CryptoWebhookEventRepositoryPort.js';
import { CryptoWebhookEventModel } from '../../../database/models/CryptoWebhookEventModel.js';

/** Mongo duplicate-key detection for the unique (provider, eventId) index. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export class MongoCryptoWebhookEventRepository
  implements CryptoWebhookEventRepositoryPort
{
  async recordIfNew(
    provider: string,
    eventId: string,
    type: string
  ): Promise<boolean> {
    try {
      await CryptoWebhookEventModel.create({ provider, eventId, type });
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false; // already processed
      throw error;
    }
  }
}
