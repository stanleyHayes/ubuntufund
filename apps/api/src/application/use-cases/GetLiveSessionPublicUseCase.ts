import type { LiveSessionPublicView } from '@ubuntu-fund/types';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import { toLiveSessionPublicView } from './mappers/liveSessionDto.js';

/**
 * Public donor-facing sheet for a live session. No token required; the mapper
 * strips the overlay token and honors the host's amount-visibility choice.
 * Returns null when the session is unknown.
 */
export class GetLiveSessionPublicUseCase {
  constructor(private readonly liveSessionRepo: LiveSessionRepositoryPort) {}

  async execute(sessionId: string): Promise<LiveSessionPublicView | null> {
    const session = await this.liveSessionRepo.findById(sessionId);
    if (!session) return null;
    return toLiveSessionPublicView(session);
  }
}
