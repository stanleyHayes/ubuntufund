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
  /**
   * Credit one settled donation to the session's `successfulDonations` and
   * `amountRaised`, exactly once per donation: the donation is claimed in the
   * same transaction as the counter bump, so a replayed (at-least-once) outbox
   * delivery changes nothing. `duplicate` is true when an earlier delivery had
   * already credited it. `session` is the current session, or null if unknown.
   */
  applyDonationStats(
    id: string,
    donationId: string,
    amount: number
  ): Promise<{ session: LiveSessionEntity | null; duplicate: boolean }>;
  /**
   * Take a refunded amount back out of `amountRaised` and, when the refund
   * completes the donation's full refund, one gift out of
   * `successfulDonations`. Never drops a counter below zero.
   */
  reverseDonationStats(id: string, amount: number, removeDonation: boolean): Promise<void>;
}
