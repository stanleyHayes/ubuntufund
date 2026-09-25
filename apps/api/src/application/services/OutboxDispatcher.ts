import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { DonationSucceededPayload, OutboxRecord } from '@ubuntu-fund/types';
import type { OutboxRepositoryPort } from '../../domain/ports/outbound/OutboxRepositoryPort.js';
import type { RealtimeDonationProjector } from './RealtimeDonationProjector.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** How many pending rows the boot sweep drains per pass. */
const SWEEP_BATCH = 100;
/**
 * How long one dispatcher holds a row. A failed or crashed dispatch keeps its
 * lease until it expires, which doubles as the retry back-off.
 */
const LEASE_MS = 120_000;
/**
 * The sweep leaves fresh rows to the in-process dispatch that follows every
 * settlement commit, so the two do not race for the same row.
 */
const SWEEP_MIN_AGE_MS = 30_000;

export interface OutboxDispatcherOptions {
  leaseMs?: number;
  sweepMinAgeMs?: number;
}

/**
 * Drains the transactional outbox: turns durably-recorded `donation.succeeded`
 * rows into their side-effects (realtime publish via the donation projector;
 * receipt/notification hooks). Dispatch runs in-process right after a
 * settlement commits so realtime is immediate, and a boot-time
 * {@link sweepPending} re-runs anything still pending — so realtime/receipts
 * survive a crash or restart between the commit and the dispatch.
 *
 * Every dispatch first takes a lease on its row, so the in-process dispatch,
 * the periodic sweep and another instance's boot sweep never run the same row
 * at the same time. Delivery is still at-least-once (a lease can expire under
 * a stalled handler, or the process can die before marking the row), so
 * handlers must stay idempotent — the live-session stat bump is exactly-once
 * per donation.
 */
export class OutboxDispatcher {
  private readonly leaseMs: number;
  private readonly sweepMinAgeMs: number;

  constructor(
    private readonly outboxRepo: OutboxRepositoryPort,
    private readonly realtimeProjector: RealtimeDonationProjector,
    private readonly donations: DonationRepositoryPort,
    options: OutboxDispatcherOptions = {}
  ) {
    this.leaseMs = options.leaseMs ?? LEASE_MS;
    this.sweepMinAgeMs = options.sweepMinAgeMs ?? SWEEP_MIN_AGE_MS;
  }

  /**
   * Dispatch a single row. Marks it dispatched on success; on failure bumps its
   * attempt counter and leaves it pending for the next sweep. Never throws —
   * dispatch failures must not fail the settlement that enqueued the row.
   */
  async dispatch(record: OutboxRecord): Promise<void> {
    try {
      if (record.status === 'dispatched') return;
      // Null: already dispatched, or another dispatcher is running it now.
      const leaseToken = await this.outboxRepo.claim(record.id, this.leaseMs);
      if (!leaseToken) return;
      await this.run(record, leaseToken);
    } catch (error) {
      await this.recordFailure(record, error);
    }
  }

  /**
   * Catch-up sweep: lease and re-dispatch pending rows older than the
   * in-process window, oldest first (call on boot and periodically).
   */
  async sweepPending(): Promise<number> {
    const createdBefore = new Date(Date.now() - this.sweepMinAgeMs);
    let count = 0;
    while (count < SWEEP_BATCH) {
      const claimed = await this.outboxRepo.claimNextPending(createdBefore, this.leaseMs);
      if (!claimed) break;
      count += 1;
      try {
        await this.run(claimed.record, claimed.leaseToken);
      } catch (error) {
        await this.recordFailure(claimed.record, error);
      }
    }
    if (count > 0) {
      logger.info({ count }, 'outbox sweep dispatched pending events');
    }
    return count;
  }

  private async run(record: OutboxRecord, leaseToken: string): Promise<void> {
    await this.handle(record);
    await this.outboxRepo.markDispatched(record.id, leaseToken);
  }

  /**
   * A failed row keeps its lease until it expires (the retry back-off), so the
   * sweep cannot spin on it; the attempt counter is best-effort bookkeeping.
   */
  private async recordFailure(record: OutboxRecord, error: unknown): Promise<void> {
    logger.error(
      { err: error, outboxId: record.id, type: record.type },
      'outbox dispatch failed; will retry on next sweep'
    );
    try {
      await this.outboxRepo.recordAttempt(record.id);
    } catch {
      // best-effort attempt bookkeeping
    }
  }

  private async handle(record: OutboxRecord): Promise<void> {
    switch (record.type) {
      case 'donation.succeeded':
        await this.handleDonationSucceeded(
          record.payload as DonationSucceededPayload
        );
        return;
      default:
        logger.warn({ type: record.type }, 'unknown outbox event type');
    }
  }

  private async handleDonationSucceeded(
    payload: DonationSucceededPayload
  ): Promise<void> {
    const current = await this.donations.findById(payload.donationId);
    // Publish realtime overlay/feed events and bump live-session stats. The
    // projector swallows its own errors, so a realtime hiccup never blocks the
    // row from being marked dispatched.
    await this.realtimeProjector.recordDonationRealtime(
      payload.campaignId,
      payload.liveSessionId,
      {
        donationId: payload.donationId,
        donorId: payload.donorId,
        donorName: current?.publicDonorName,
        amount: payload.amount,
        currency: payload.currency,
        message: current?.publicMessage,
        isAnonymous: !current?.publicContentApproved || current.isAnonymous,
        createdAt: new Date(payload.createdAt),
      }
    );

    // Opt-in activity delivery is tracked atomically on the financial records
    // and reconciled independently by MongoActivityAlerts.
  }
}
