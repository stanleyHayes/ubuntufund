import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type {
  RefundRecord,
  RefundRepositoryPort,
  RefundStatus,
} from '../../domain/ports/outbound/RefundRepositoryPort.js';

/** A donor's own refund requests, e.g. for the "My Refunds" table. */
export interface MyRefundDTO {
  id: string;
  donationId: string;
  campaignName: string;
  amount: number;
  currency: string;
  requestDate: Date;
  status: RefundStatus;
  reason: string;
}

export class ListMyRefundsUseCase {
  constructor(
    private readonly refundRepo: RefundRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(requesterId: string): Promise<MyRefundDTO[]> {
    const refunds = await this.refundRepo.findByRequesterId(requesterId);
    return Promise.all(refunds.map((refund) => this.toDTO(refund)));
  }

  private async toDTO(refund: RefundRecord): Promise<MyRefundDTO> {
    const campaign = await this.campaignRepo.findById(refund.campaignId);

    return {
      id: refund.id,
      donationId: refund.donationId,
      campaignName: campaign ? campaign.title : 'Campaign',
      amount: refund.netAmount,
      currency: refund.currency,
      requestDate: refund.createdAt,
      status: refund.status,
      reason: refund.reason,
    };
  }
}
