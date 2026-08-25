import type { DonationSucceededPayload, OutboxRecord } from '@ubuntu-fund/types';
import type { OutboxRepositoryPort } from '../../domain/ports/outbound/OutboxRepositoryPort.js';
import type { RealtimeDonationProjector } from './RealtimeDonationProjector.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** How many pending rows the boot sweep drains per pass. */
const SWEEP_BATCH = 100;

/**
 * Drains the transactional outbox: turns durably-recorded `donation.succeeded`
 * rows into their side-effects (realtime publish via the donation projector;
 * receipt/notification hooks). Dispatch runs in-process right after a
 * settlement commits so realtime is immediate, and a boot-time
 * {@link sweepPending} re-runs anything still pending — so realtime/receipts
 * survive a crash or restart between the commit and the dispatch.
 *
 * Handlers must be idempotent: a row may be dispatched more than once (an
 * in-process dispatch that raced a restart, then the sweep).
 */
export class OutboxDispatcher {
  constructor(
    private readonly outboxRepo: OutboxRepositoryPort,
    private readonly realtimeProjector: RealtimeDonationProjector
  ) {}

  /**
   * Dispatch a single row. Marks it dispatched on success; on failure bumps its
   * attempt counter and leaves it pending for the next sweep. Never throws —
   * dispatch failures must not fail the settlement that enqueued the row.
   */
  async dispatch(record: OutboxRecord): Promise<void> {
    try {
      if (record.status === 'dispatched') return;
      await this.handle(record);
      await this.outboxRepo.markDispatched(record.id);
    } catch (error) {
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
  }

  /** Catch-up sweep: re-dispatch every pending row (call on boot). */
  async sweepPending(): Promise<number> {
    const pending = await this.outboxRepo.findPending(SWEEP_BATCH);
    for (const record of pending) {
      await this.dispatch(record);
    }
    if (pending.length > 0) {
      logger.info({ count: pending.length }, 'outbox sweep dispatched pending events');
    }
    return pending.length;
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
    // Publish realtime overlay/feed events and bump live-session stats. The
    // projector swallows its own errors, so a realtime hiccup never blocks the
    // row from being marked dispatched.
    await this.realtimeProjector.recordDonationRealtime(
      payload.campaignId,
      payload.liveSessionId,
      {
        donationId: payload.donationId,
        donorId: payload.donorId,
        donorName: payload.donorName,
        amount: payload.amount,
        currency: payload.currency,
        message: payload.message,
        isAnonymous: payload.isAnonymous,
        createdAt: new Date(payload.createdAt),
      }
    );

    // Receipt side-effect: registered donors could be emailed / notified here.
    // Kept as a durable, logged hook until the receipts channel is wired.
    logger.info(
      { donationId: payload.donationId, campaignId: payload.campaignId },
      'donation receipt side-effect dispatched'
    );
  }
}
