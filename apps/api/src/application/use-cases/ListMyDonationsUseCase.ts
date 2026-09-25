import type { DonationIntentStatus, PaymentMethod } from '@ubuntu-fund/types';
import type { DonationEntity } from '../../domain/entities/Donation.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type {
  DonationPaymentState,
  DonationPaymentStateReadPort,
} from '../../domain/ports/outbound/DonationPaymentStateReadPort.js';

export type MyDonationStatus =
  | 'completed'
  | 'pending'
  | 'refund_pending'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed';

/**
 * A donor's own donation history. A Donation row is written once, at
 * settlement; `status` reflects what happened to the money since (refunds,
 * disputes), read from the intent that settled it.
 */
export interface MyDonationDTO {
  id: string;
  campaignId: string;
  campaignName: string;
  amount: number;
  currency: string;
  date: Date;
  status: MyDonationStatus;
  /** A refund request is already open for this donation. */
  refundRequested: boolean;
  paymentMethod: PaymentMethod;
  message?: string;
  isAnonymous: boolean;
}

/** How a settled intent's status reads in the donor's history. */
export function myDonationStatus(intentStatus?: DonationIntentStatus): MyDonationStatus {
  switch (intentStatus) {
    case 'REFUND_PENDING':
      return 'refund_pending';
    case 'PARTIALLY_REFUNDED':
      return 'partially_refunded';
    case 'REFUNDED':
    case 'CHARGEBACK':
      return 'refunded';
    case 'DISPUTED':
      return 'disputed';
    default:
      // SUCCEEDED, or a pre-ledger donation with no linked intent.
      return 'completed';
  }
}

export class ListMyDonationsUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    /** Optional: without it every donation reads as completed (legacy behaviour). */
    private readonly paymentStates?: DonationPaymentStateReadPort
  ) {}

  async execute(donorId: string): Promise<MyDonationDTO[]> {
    const donations = await this.donationRepo.findByDonorId(donorId);
    const states = this.paymentStates
      ? await this.paymentStates.statesForDonations(donations.map((d) => d.id))
      : new Map<string, DonationPaymentState>();
    return Promise.all(donations.map((donation) => this.toDTO(donation, states.get(donation.id))));
  }

  private async toDTO(donation: DonationEntity, state?: DonationPaymentState): Promise<MyDonationDTO> {
    const campaign = await this.campaignRepo.findById(donation.campaignId);

    return {
      id: donation.id,
      campaignId: donation.campaignId,
      campaignName: campaign ? campaign.title : 'Campaign',
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      date: donation.createdAt,
      status: myDonationStatus(state?.intentStatus),
      refundRequested: state?.refundRequested ?? false,
      paymentMethod: donation.paymentMethod,
      message: donation.message,
      isAnonymous: donation.isAnonymous,
    };
  }
}
