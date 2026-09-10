import type { Payout, TransferRecipient } from '@ubuntu-fund/types'
import type { PayoutEntity } from '../../../domain/entities/Payout.js'
import type { TransferRecipientEntity } from '../../../domain/entities/TransferRecipient.js'

export function toPayoutDto(entity: PayoutEntity): Payout {
  const p = entity.toPlain()
  return {
    id: p.id,
    campaignId: p.campaignId,
    recipientId: p.recipientId,
    amount: p.amount,
    type: p.type,
    fee: p.fee,
    netAmount: p.netAmount,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    providerRef: p.providerRef,
    transferCode: p.transferCode,
    providerStatus: p.providerStatus,
    automationReason: p.automationReason,
    requestedBy: p.requestedBy,
    approvedBy: p.approvedBy,
    firstApprovedBy: p.firstApprovedBy,
    firstApprovedAt: p.firstApprovedAt,
    legs: p.legs,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export function toTransferRecipientDto(entity: TransferRecipientEntity): TransferRecipient {
  const p = entity.toPlain()
  return {
    id: p.id,
    campaignId: p.campaignId,
    createdBy: p.createdBy,
    type: p.type,
    accountNumber: p.accountNumber,
    bankCode: p.bankCode,
    accountName: p.accountName,
    recipientCode: p.recipientCode,
    currency: p.currency,
    createdAt: p.createdAt,
  }
}
