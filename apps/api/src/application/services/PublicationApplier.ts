import type { PublicationOutcomeReason } from '@ubuntu-fund/types';
import type {
  ClaimedPublication, PublicationApplierPort, PublicationApplyContext, PublicationApplyHandlers, PublicationApplyReview,
  PublicationApplyStore, PublicationProgress,
} from '../../domain/ports/outbound/PublicationApplyPort.js';
import { credentialDigestMatches } from '../../domain/services/publicationCredential.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import {
  LostPublicationLease, PublicationApplyRefusal, PublicationOutsideTransaction, isPublicationFenceCode, publicationFenceOutcome,
} from '../../infrastructure/adapters/inbound/middleware/publicationErrors.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** Waits after a failed attempt (±20%): 15 s, 1 min, 5 min, 15 min, 1 h, 3 h, 6 h. */
export const PUBLICATION_RETRY_BACKOFF_MS: readonly number[] = [15_000, 60_000, 300_000, 900_000, 3_600_000, 10_800_000, 21_600_000];
/** The eighth failed attempt gives up: `not_published/unavailable`. */
export const PUBLICATION_MAX_ATTEMPTS = 8;
const JITTER = 0.2;
/** How long one attempt holds a version; an attempt that crashed is taken over once it expires. */
const LEASE_MS = 120_000;
/** Versions one sweep attempts, the longest waiting first. */
const SWEEP_BATCH = 20;
/** Never start publishing this close to the end of the approval, or of the record. */
const APPROVAL_MARGIN_MS = 60_000;
const PURGE_MARGIN_MS = 5 * 60_000;

const EVENT = 'publication.apply';

export interface PublicationApplierOptions {
  /**
   * PUBLISH_ON_APPROVAL_ENABLED: while off, nothing is claimed or attempted,
   * and the sweep returns waiting approvals to their authors instead.
   */
  enabled?: () => boolean;
  leaseMs?: number;
  batchSize?: number;
  /** For tests: the jitter source (0 ≤ value < 1). */
  random?: () => number;
}

type Ended = 'not_published' | 'superseded';
type Outcome =
  /** `error`: the handler failed after its publication had committed. */
  | { kind: 'published'; error?: unknown }
  | { kind: 'end'; state: Ended; reason: PublicationOutcomeReason; error?: unknown }
  | { kind: 'lost' }
  | { kind: 'retry'; error: unknown };

const end = (state: Ended, reason: PublicationOutcomeReason, error?: unknown): Outcome => ({ kind: 'end', state, reason, ...(error ? { error } : {}) });

/**
 * Names and codes only. Error messages can carry submitted text, and a
 * duplicate-key message the key's value, so neither is ever logged.
 */
const IDENTIFIER = /^[A-Za-z]\w{0,63}$/;
function errorFields(error: unknown): { errName: string; errCode?: string | number } {
  const value = (error && typeof error === 'object' ? error : {}) as { name?: unknown; code?: unknown; statusCode?: unknown };
  const errName = typeof value.name === 'string' && IDENTIFIER.test(value.name) ? value.name : 'Error';
  // An AppError without a fence code still says which status it carried.
  const code = value.code ?? value.statusCode;
  if (typeof code === 'number' && Number.isSafeInteger(code)) return { errName, errCode: code };
  if (typeof code === 'string' && IDENTIFIER.test(code)) return { errName, errCode: code };
  return { errName };
}

/** What a handler may see: never the lease token or the credential digest. */
function reviewOf(claimed: ClaimedPublication): PublicationApplyReview {
  const { leaseToken: _leaseToken, credentialDigest: _credentialDigest, ...review } = claimed;
  return review;
}

/**
 * Publishes approved versions (publishing on approval). One attempt claims
 * the version with a lease, re-runs the author's checks, and lets the
 * action's handler write it and record it as published in one transaction.
 * Expected refusals end the attempt with a reason the author is told; any
 * other failure is retried with backoff, then given up as `unavailable`.
 *
 * Exactly once: the content write and the record's move to `published`
 * commit together through a compare-and-set on this attempt's lease token,
 * which another attempt's claim, the author's own request, a withdrawal or a
 * newer version all change first when they win.
 */
export class PublicationApplier implements PublicationApplierPort {
  private readonly enabled: () => boolean;
  private readonly leaseMs: number;
  private readonly batchSize: number;
  private readonly random: () => number;
  private readonly running = new Set<Promise<unknown>>();

  constructor(private readonly store: PublicationApplyStore, private readonly handlers: PublicationApplyHandlers, options: PublicationApplierOptions = {}) {
    this.enabled = options.enabled ?? (() => false);
    this.leaseMs = options.leaseMs ?? LEASE_MS;
    this.batchSize = options.batchSize ?? SWEEP_BATCH;
    this.random = options.random ?? Math.random;
  }

  applyNow(reviewId: string): Promise<PublicationProgress | null> {
    const attempt = this.attemptSafely(reviewId);
    this.running.add(attempt);
    const done = () => { this.running.delete(attempt); };
    void attempt.then(done, done);
    return attempt;
  }

  async sweep(): Promise<number> {
    if (!this.enabled()) return this.release();
    let ids: string[];
    try { ids = await this.store.due(new Date(), this.batchSize); }
    catch (error) {
      logger.error({ event: EVENT, ...errorFields(error) }, 'Publication sweep could not read due versions');
      return 0;
    }
    // One at a time: a sweep never adds more than one attempt's load.
    for (const id of ids) await this.applyNow(id);
    return ids.length;
  }

  /**
   * Switched off: nothing is attempted, and approvals still waiting to
   * publish become plain approvals their authors publish by submitting them
   * again, as the author is shown while it is off. Each author is told,
   * whether or not it is ever switched on again.
   */
  private async release(): Promise<number> {
    try {
      const released = await this.store.releaseWaiting(new Date(), this.batchSize);
      if (released) logger.info({ event: EVENT, state: 'released', count: released }, 'Publishing on approval is off; waiting approvals were returned to their authors');
      return released;
    } catch (error) {
      logger.error({ event: EVENT, ...errorFields(error) }, 'Publication sweep could not return waiting approvals to their authors');
      return 0;
    }
  }

  /** Resolves once every attempt this applier started has ended (tests and shutdown). */
  async idle(): Promise<void> {
    // An attempt can start while others end, so look again until none is left.
    while (this.running.size) await Promise.allSettled(this.running);
  }

  private async attemptSafely(reviewId: string): Promise<PublicationProgress | null> {
    try {
      if (!this.enabled()) return await this.store.progress(reviewId);
      return await this.attempt(reviewId);
    } catch (error) {
      // The store failed (the database, say). A claimed version keeps its
      // lease until it expires; the sweep then takes it over.
      logger.error({ event: EVENT, reviewId, ...errorFields(error) }, 'Publication attempt could not record its outcome');
      return this.store.progress(reviewId).catch(() => null);
    }
  }

  private async attempt(reviewId: string): Promise<PublicationProgress | null> {
    const claim = await this.store.claim(reviewId, new Date(), this.leaseMs);
    if (!claim.claimed) return claim.progress;
    const claimed = claim.claimed;
    await this.settle(claimed, await this.run(claimed));
    return this.store.progress(reviewId);
  }

  private async run(claimed: ClaimedPublication): Promise<Outcome> {
    const now = Date.now();
    if (claimed.approvalExpiresAt.getTime() <= now + APPROVAL_MARGIN_MS || claimed.purgeAt.getTime() <= now + PURGE_MARGIN_MS) return end('not_published', 'approval_expired');
    // Attempts that kept crashing before they could record an outcome.
    if (claimed.attempt > PUBLICATION_MAX_ATTEMPTS) return end('not_published', 'unavailable');
    const handler = this.handlers.get(claimed.action);
    if (!handler) return end('not_published', 'unavailable', new Error('No publication handler'));
    const review = reviewOf(claimed);
    let proposal: unknown = null;
    try { proposal = handler.parse(review); } catch { proposal = null; }
    if (proposal === null || proposal === undefined) return end('not_published', 'unreadable');

    // The checks every publication repeats (the action's writer repeats them
    // again inside its transaction, as fences).
    const author = await this.store.author(claimed.actorId);
    if (!author || author.closed) return end('not_published', 'account_unavailable');
    if (!credentialDigestMatches(claimed.credentialDigest, claimed.actorId, author.authVersion)) return end('not_published', 'credentials_changed');
    if (author.restricted) return end('not_published', 'restricted');
    if (author.role !== 'admin' && !author.agreementAccepted) return end('not_published', 'terms_not_accepted');

    const context: PublicationApplyContext = {
      review, proposal, author: { id: author.id, role: author.role, authVersion: author.authVersion },
      publish: (resourceId, options = {}) => this.store.publish(claimed, resourceId, options),
    };
    try { await handler.precheck?.(context); }
    catch (error) { return this.classify(claimed, error); }
    // Published only when the transaction run that recorded it committed: a
    // run rolled back by a transient error and run again without publishing
    // does not count.
    const result = await this.store.commit(claimed, () => handler.commit(context));
    if (result.published) return 'error' in result ? { kind: 'published', error: result.error } : { kind: 'published' };
    if ('error' in result) return this.classify(claimed, result.error);
    // A commit that neither published nor refused is a handler bug: retrying
    // could write its content again, so it ends here.
    return end('not_published', 'unavailable', new Error('The publication handler did not publish'));
  }

  private async classify(claimed: ClaimedPublication, error: unknown): Promise<Outcome> {
    if (error instanceof LostPublicationLease) return { kind: 'lost' };
    if (error instanceof PublicationApplyRefusal) return end(error.state, error.reason);
    if (error instanceof PublicationOutsideTransaction) return end('not_published', 'unavailable', error);
    if (error instanceof AppError && isPublicationFenceCode(error.code)) {
      if (error.code !== 'account_session') {
        const { state, reason } = publicationFenceOutcome(error.code);
        return end(state, reason);
      }
      // The session fence failed: a closed account, or credentials that rotated after the check.
      try {
        const author = await this.store.author(claimed.actorId);
        return end('not_published', !author || author.closed ? 'account_unavailable' : 'credentials_changed');
      } catch (readError) { return { kind: 'retry', error: readError }; }
    }
    // Duplicate keys, conflicts, timeouts, the network: try again later.
    return { kind: 'retry', error };
  }

  private log(claimed: ClaimedPublication, state: string, reason?: PublicationOutcomeReason, error?: unknown): void {
    const fields = { event: EVENT, reviewId: claimed.id, action: claimed.action, state, ...(reason ? { reason } : {}), attempt: claimed.attempt };
    if (reason === 'unavailable') logger.error({ ...fields, ...(error ? errorFields(error) : {}) }, 'Publication on approval failed');
    else logger.info(fields, 'Publication on approval ended');
  }

  private async settle(claimed: ClaimedPublication, outcome: Outcome): Promise<void> {
    switch (outcome.kind) {
      case 'published':
        this.log(claimed, 'published');
        if ('error' in outcome) logger.warn({ event: EVENT, reviewId: claimed.id, action: claimed.action, state: 'published', attempt: claimed.attempt, ...errorFields(outcome.error) }, 'Published on approval; the handler failed afterwards');
        return;
      case 'lost':
        // Someone else ended it (the author published or withdrew it, a newer
        // version replaced it, or another attempt took over). The publish
        // compare-and-set also needs an unexpired approval: when that is what
        // failed, this attempt still holds the version and ends it.
        if (claimed.approvalExpiresAt.getTime() <= Date.now() && await this.store.finish(claimed, 'not_published', 'approval_expired')) {
          this.log(claimed, 'not_published', 'approval_expired');
        }
        return;
      case 'end':
        if (await this.store.finish(claimed, outcome.state, outcome.reason)) this.log(claimed, outcome.state, outcome.reason, outcome.error);
        return;
      case 'retry': {
        const nextAt = this.nextAttemptAt(claimed);
        if (!nextAt) {
          if (await this.store.finish(claimed, 'not_published', 'unavailable')) this.log(claimed, 'not_published', 'unavailable', outcome.error);
          return;
        }
        if (await this.store.requeue(claimed, nextAt)) {
          logger.warn({ event: EVENT, reviewId: claimed.id, action: claimed.action, state: 'queued', attempt: claimed.attempt, nextAttemptAt: nextAt.toISOString(), ...errorFields(outcome.error) }, 'Publication attempt failed; it will be retried');
        }
      }
    }
  }

  /** When to try again, or null to give up: out of attempts, or the next try would fall outside the window. */
  private nextAttemptAt(claimed: ClaimedPublication): Date | null {
    const base = PUBLICATION_RETRY_BACKOFF_MS[claimed.attempt - 1];
    if (base === undefined || claimed.attempt >= PUBLICATION_MAX_ATTEMPTS) return null;
    const next = Date.now() + Math.round(base * (1 - JITTER + 2 * JITTER * this.random()));
    if (next >= claimed.approvalExpiresAt.getTime() - APPROVAL_MARGIN_MS || next >= claimed.purgeAt.getTime() - PURGE_MARGIN_MS) return null;
    return new Date(next);
  }
}
