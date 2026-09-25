import type { LegalAcceptanceEvent, LegalAcceptanceLogPort } from '../../../../domain/ports/outbound/LegalAcceptanceLogPort.js';
import { LegalAcceptanceEventModel } from '../../../database/models/LegalAcceptanceEventModel.js';

export class MongoLegalAcceptanceLog implements LegalAcceptanceLogPort {
  async record(event: LegalAcceptanceEvent): Promise<void> {
    // Array form so the insert joins an ambient MongoUnitOfWork transaction.
    await LegalAcceptanceEventModel.create([{
      userId: event.userId,
      version: event.version,
      acceptedTerms: event.acceptedTerms,
      ageConfirmed: event.ageConfirmed,
      acceptedAt: event.acceptedAt,
      source: event.source,
      ...(event.ip ? { ip: event.ip.slice(0, 64) } : {}),
      ...(event.userAgent ? { userAgent: event.userAgent.slice(0, 512) } : {}),
    }]);
  }
}
