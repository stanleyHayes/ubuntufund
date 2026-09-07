import type { JournalEntry, JournalLine } from '@ubuntu-fund/types';
import type { LedgerRepositoryPort } from '../../../../domain/ports/outbound/LedgerRepositoryPort.js';
import type {
  JournalEntryEntity,
  DraftJournalLine,
} from '../../../../domain/entities/JournalEntry.js';
import {
  LedgerAccountModel,
  type LedgerAccountDocument,
} from '../../../database/models/LedgerAccountModel.js';
import {
  JournalEntryModel,
  type JournalEntryDocument,
} from '../../../database/models/JournalEntryModel.js';
import {
  JournalLineModel,
  type JournalLineDocument,
} from '../../../database/models/JournalLineModel.js';

function lineToDomain(doc: JournalLineDocument): JournalLine {
  return {
    id: doc._id!.toString(),
    journalEntryId: doc.journalEntryId,
    accountId: doc.accountId,
    accountKind: doc.accountKind,
    accountOwnerId: doc.accountOwnerId,
    direction: doc.direction,
    amount: doc.amount,
    currency: doc.currency,
    createdAt: doc.createdAt,
  };
}

function entryToDomain(
  doc: JournalEntryDocument,
  lines: JournalLineDocument[]
): JournalEntry {
  return {
    id: doc._id!.toString(),
    donationId: doc.donationId,
    donationIntentId: doc.donationIntentId,
    memo: doc.memo,
    currency: doc.currency,
    createdAt: doc.createdAt,
    lines: lines.map(lineToDomain),
  };
}

/** Mongo duplicate-key error code. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export class MongoLedgerRepository implements LedgerRepositoryPort {
  /** Find-or-create the account a line posts against. */
  private async ensureAccount(
    line: DraftJournalLine
  ): Promise<LedgerAccountDocument> {
    return LedgerAccountModel.findOneAndUpdate(
      { kind: line.accountKind, ownerId: line.accountOwnerId, currency: line.currency },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );
  }

  async postEntry(entry: JournalEntryEntity): Promise<JournalEntry> {
    const intentId = entry.donationIntentId;

    // Idempotency: a settled intent posts exactly one entry. Return the
    // existing one rather than double-posting on a retry.
    if (intentId) {
      const existing = await this.findEntryByDonationIntentId(intentId);
      if (existing) return existing;
    }

    let entryDoc: JournalEntryDocument;
    try {
      entryDoc = await JournalEntryModel.create({
        donationId: entry.donationId,
        donationIntentId: intentId,
        memo: entry.memo,
        currency: entry.currency,
        createdAt: new Date(),
      });
    } catch (error) {
      // Lost a race to post the same intent's entry — resolve to the winner.
      if (intentId && isDuplicateKeyError(error)) {
        const existing = await this.findEntryByDonationIntentId(intentId);
        if (existing) return existing;
      }
      throw error;
    }

    const entryId = entryDoc._id!.toString();

    // Resolve each line's account, then append all lines in one insertMany.
    const accounts = await Promise.all(
      entry.lines.map((line) => this.ensureAccount(line))
    );
    const lineDocs = await JournalLineModel.insertMany(
      entry.lines.map((line, i) => ({
        journalEntryId: entryId,
        accountId: accounts[i]!._id!.toString(),
        accountKind: line.accountKind,
        accountOwnerId: line.accountOwnerId,
        direction: line.direction,
        amount: line.amount,
        currency: line.currency,
        createdAt: new Date(),
      }))
    );

    return entryToDomain(entryDoc, lineDocs as unknown as JournalLineDocument[]);
  }

  async findEntryByDonationIntentId(
    donationIntentId: string
  ): Promise<JournalEntry | null> {
    const entry = await JournalEntryModel.findOne({ donationIntentId });
    if (!entry) return null;
    const lines = await JournalLineModel.find({
      journalEntryId: entry._id!.toString(),
    });
    return entryToDomain(entry, lines);
  }

  async sumCampaignRaised(campaignId: string, currency: string): Promise<number> {
    // Net raised = campaign-account debits (donations) MINUS credits (refund
    // compensating entries, spec §14). Summing debits alone would overstate the
    // total once refunds are posted, so the two directions are netted.
    const rows = await JournalLineModel.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          accountKind: 'campaign',
          accountOwnerId: campaignId,
          currency,
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: ['$direction', 'debit'] },
                '$amount',
                { $multiply: ['$amount', -1] },
              ],
            },
          },
        },
      },
    ]);
    return rows[0]?.total ?? 0;
  }
}
