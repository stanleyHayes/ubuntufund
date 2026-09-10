import type { CreatePayoutRecipientInput, TransferRecipient } from '@ubuntu-fund/types'
import { TransferRecipientEntity } from '../../domain/entities/TransferRecipient.js'
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js'
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { toTransferRecipientDto } from './mappers/payoutDto.js'

export interface PayoutRequester {
  userId: string
  role?: string
}

/** The platform's only settlement currency. */
const CURRENCY = 'GHS'

/**
 * Register a payout recipient (bank or mobile money) for a campaign with the
 * payment provider, then persist it. Owner (or admin) only. The provider call
 * returns 501 when payouts are unconfigured.
 */
export class CreatePayoutRecipientUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly transferRecipientRepo: TransferRecipientRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
  ) {}

  async execute(
    campaignId: string,
    input: CreatePayoutRecipientInput,
    requester: PayoutRequester,
  ): Promise<TransferRecipient> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501)
    }

    const campaign = await this.campaignRepo.findById(campaignId)
    if (!campaign) {
      throw new AppError('Campaign not found', 404)
    }

    const isOwner = campaign.creatorId === requester.userId
    const isAdmin = requester.role === 'admin'
    if (!isOwner && !isAdmin) {
      throw new AppError('Only the campaign owner can add a payout recipient', 403)
    }

    if (!input.accountNumber || !input.bankCode || !input.accountName) {
      throw new AppError('accountNumber, bankCode and accountName are required', 400)
    }

    // Resolution confirms a registered name, not ownership or wallet capacity.
    let resolvedAccountName: string | undefined
    try {
      resolvedAccountName = (
        await this.paymentGateway.resolveAccount?.(input.accountNumber.trim(), input.bankCode)
      )?.accountName
    } catch {
      /* Fail closed into manual review; never label provider errors as verification. */
    }
    const normalize = (name: string) =>
      name
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '')
    const verificationStatus =
      resolvedAccountName && normalize(resolvedAccountName) === normalize(input.accountName)
        ? ('name_matched' as const)
        : ('needs_review' as const)
    const recipientCode = await this.paymentGateway.createTransferRecipient({
      type: input.type,
      name: input.accountName,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      currency: CURRENCY,
    })

    const saved = await this.transferRecipientRepo.create(
      new TransferRecipientEntity({
        id: '',
        campaignId: campaign.id,
        createdBy: requester.userId,
        type: input.type,
        accountNumber: input.accountNumber,
        bankCode: input.bankCode,
        accountName: input.accountName.trim(),
        resolvedAccountName,
        verificationStatus,
        recipientCode,
        currency: CURRENCY,
        createdAt: new Date(),
      }),
    )

    return toTransferRecipientDto(saved)
  }
}
