import type { DonationIntentStatus } from '@ubuntu-fund/types';
import type {
  DonationPaymentState,
  DonationPaymentStateReadPort,
} from '../../../../domain/ports/outbound/DonationPaymentStateReadPort.js';
import { JournalEntryModel } from '../../../database/models/JournalEntryModel.js';
import { DonationIntentModel } from '../../../database/models/DonationIntentModel.js';
import { RefundModel } from '../../../database/models/RefundModel.js';

/** Batched: three indexed queries for a whole history page, never one per row. */
export class MongoDonationPaymentStateRead implements DonationPaymentStateReadPort {
  async statesForDonations(donationIds: string[]): Promise<Map<string, DonationPaymentState>> {
    const states = new Map<string, DonationPaymentState>();
    if (!donationIds.length) return states;
    const [entries, refunds] = await Promise.all([
      JournalEntryModel.find({ donationId: { $in: donationIds }, donationIntentId: { $exists: true } })
        .select('donationId donationIntentId').lean(),
      RefundModel.find({ donationId: { $in: donationIds } }).select('donationId').lean(),
    ]);
    const intentIdByDonation = new Map(entries.map((e) => [String(e.donationId), String(e.donationIntentId)]));
    const intents = await DonationIntentModel.find({ _id: { $in: [...intentIdByDonation.values()] } })
      .select('status').lean();
    const statusByIntent = new Map(intents.map((i) => [String(i._id), i.status as DonationIntentStatus]));
    const requested = new Set(refunds.map((r) => String(r.donationId)));
    for (const id of donationIds) {
      const intentId = intentIdByDonation.get(id);
      states.set(id, {
        intentStatus: intentId ? statusByIntent.get(intentId) : undefined,
        refundRequested: requested.has(id),
      });
    }
    return states;
  }
}
