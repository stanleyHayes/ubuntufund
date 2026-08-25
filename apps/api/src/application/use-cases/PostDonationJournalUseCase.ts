import type {
  DonationSettlementBreakdown,
  JournalEntry,
} from '@ubuntu-fund/types';
import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';

export interface PostDonationJournalRefs {
  campaignId: string;
  donationId: string;
  donationIntentId: string;
  memo?: string;
}

/**
 * Records the immutable double-entry for a settled donation: gross / processor
 * fee / platform fee / optional tip / beneficiary-net, as one balanced,
 * append-only journal entry. Idempotent on the donation intent (the ledger
 * repository dedupes by `donationIntentId`), so a retried settlement never
 * double-posts.
 */
export class PostDonationJournalUseCase {
  constructor(private readonly ledgerRepo: LedgerRepositoryPort) {}

  async execute(
    breakdown: DonationSettlementBreakdown,
    refs: PostDonationJournalRefs
  ): Promise<JournalEntry> {
    const entry = JournalEntryEntity.forDonation(breakdown, refs);
    return this.ledgerRepo.postEntry(entry);
  }
}
