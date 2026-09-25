import type { PaginatedResponse } from '@ubuntu-fund/types';
import type {
  DisputeRepositoryPort,
  DisputeRecord,
  DisputeListParams,
  DisputeStatus,
} from '../../domain/ports/outbound/DisputeRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';

export interface DisputeDTO {
  id: string;
  campaignId: string;
  campaignTitle: string;
  reporterId: string;
  reporterName: string;
  assigneeId?: string;
  assigneeName?: string;
  reason: string;
  description?: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  /** Provider-originated case details (absent on staff disputes). */
  source?: 'staff' | 'paystack';
  /** 'chargeback' or 'external_refund' for a provider case. */
  providerCaseKind?: 'chargeback' | 'external_refund';
  transactionReference?: string;
  donationIntentId?: string;
  amount?: number;
  currency?: string;
  dueAt?: Date;
  providerStatus?: string;
  providerResolution?: string;
  reversalOperationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Which kind of provider case a dispute is, from its provider id. */
export function providerCaseKind(dispute: Pick<DisputeRecord, 'source' | 'providerDisputeId'>): 'chargeback' | 'external_refund' | undefined {
  if (dispute.source !== 'paystack' || !dispute.providerDisputeId) return undefined;
  if (dispute.providerDisputeId.startsWith('paystack:dispute:')) return 'chargeback';
  if (dispute.providerDisputeId.startsWith('paystack:refund:')) return 'external_refund';
  return undefined;
}

export class GetDisputeUseCase {
  constructor(
    private readonly disputeRepo: DisputeRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async getById(id: string): Promise<DisputeDTO | null> {
    const dispute = await this.disputeRepo.findById(id);
    return dispute ? this.toDTO(dispute) : null;
  }

  async list(params: DisputeListParams): Promise<PaginatedResponse<DisputeDTO>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const { items, total } = await this.disputeRepo.findAll({
      ...params,
      page,
      pageSize,
    });

    const dtos = await Promise.all(items.map((item) => this.toDTO(item)));

    return {
      items: dtos,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async toDTO(dispute: DisputeRecord): Promise<DisputeDTO> {
    // Provider-originated cases carry a system reporter, not a user id.
    const systemReporter = dispute.reporterId.startsWith('system:');
    const [campaign, reporter, assignee] = await Promise.all([
      this.campaignRepo.findById(dispute.campaignId),
      systemReporter ? Promise.resolve(null) : this.userRepo.findById(dispute.reporterId),
      dispute.assigneeId
        ? this.userRepo.findById(dispute.assigneeId)
        : Promise.resolve(null),
    ]);

    return {
      id: dispute.id,
      campaignId: dispute.campaignId,
      campaignTitle: campaign ? campaign.title : 'Unknown campaign',
      reporterId: dispute.reporterId,
      reporterName: systemReporter
        ? 'Paystack (payment provider)'
        : reporter ? reporter.name : 'Unknown user',
      assigneeId: dispute.assigneeId,
      assigneeName: assignee ? assignee.name : undefined,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      resolution: dispute.resolution,
      resolvedBy: dispute.resolvedBy,
      resolvedAt: dispute.resolvedAt,
      source: dispute.source,
      providerCaseKind: providerCaseKind(dispute),
      transactionReference: dispute.transactionReference,
      donationIntentId: dispute.donationIntentId,
      amount: dispute.amount,
      currency: dispute.currency,
      dueAt: dispute.dueAt,
      providerStatus: dispute.providerStatus,
      providerResolution: dispute.providerResolution,
      reversalOperationId: dispute.reversalOperationId,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
    };
  }
}
