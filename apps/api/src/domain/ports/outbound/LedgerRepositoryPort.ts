import type { JournalEntry } from '@ubuntu-fund/types';
import type { JournalEntryEntity } from '../../entities/JournalEntry.js';

export interface LedgerRepositoryPort {
  /**
   * Post a balanced entry and its lines as one immutable append. Idempotent on
   * `donationIntentId`: a second post for an already-recorded intent resolves
   * to the existing entry instead of double-posting. Returns the persisted
   * entry (with ids), or the pre-existing one on a duplicate.
   */
  postEntry(entry: JournalEntryEntity): Promise<JournalEntry>;

  /** The entry that settled a given donation intent, if any. */
  findEntryByDonationIntentId(donationIntentId: string): Promise<JournalEntry | null>;

  /**
   * Sum of `campaign`-account debits for a campaign — the raised total derived
   * purely from posted ledger activity. Used to (re)project campaign totals.
   */
  sumCampaignRaised(campaignId: string, currency: string): Promise<number>;
}
