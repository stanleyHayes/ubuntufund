import type { LiveSessionStats } from '@ubuntu-fund/types';
import type { LiveSessionEntity } from '../../entities/LiveSession.js';

export interface LiveSessionRepositoryPort {
  save(session: LiveSessionEntity): Promise<LiveSessionEntity>;
  findById(id: string): Promise<LiveSessionEntity | null>;
  findByCampaignId(campaignId: string): Promise<LiveSessionEntity[]>;
  findActiveByCampaignId(campaignId: string): Promise<LiveSessionEntity | null>;
  update(session: LiveSessionEntity): Promise<LiveSessionEntity>;
  /**
   * Atomically add to the session's rolling stat counters. Only the provided
   * keys are incremented. Returns the updated session, or null when no session
   * with `id` exists.
   */
  incrementStats(
    id: string,
    delta: Partial<LiveSessionStats>
  ): Promise<LiveSessionEntity | null>;
}
