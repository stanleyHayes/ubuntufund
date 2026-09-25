import type { DonationIntentStatus } from '@ubuntu-fund/types';

/** Where a settled donation's money stands now (it can be refunded or disputed later). */
export interface DonationPaymentState {
  /** Status of the intent that settled the donation; absent for pre-ledger donations. */
  intentStatus?: DonationIntentStatus;
  /** Whether the donor already asked for a refund. */
  refundRequested: boolean;
}

/**
 * Read model for donation history. A Donation row never changes after
 * settlement; refunds and disputes move the settling DonationIntent, linked to
 * the donation through its ledger journal entry.
 */
export interface DonationPaymentStateReadPort {
  statesForDonations(donationIds: string[]): Promise<Map<string, DonationPaymentState>>;
}
