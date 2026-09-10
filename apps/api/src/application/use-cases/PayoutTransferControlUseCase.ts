import type { Payout } from '@ubuntu-fund/types'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js'
import type { HandlePayoutWebhookUseCase } from './HandlePayoutWebhookUseCase.js'
import { toPayoutDto } from './mappers/payoutDto.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'

/** Refresh and authorization always refer to an existing payout; these operations never create another transfer. */
export class PayoutTransferControlUseCase {
  constructor(
    private payouts: PayoutRepositoryPort,
    private gateway: PaymentGatewayPort,
    private settle: HandlePayoutWebhookUseCase,
  ) {}
  async execute(
    id: string,
    action: 'refresh' | 'resend' | 'authorize',
    otp?: string,
  ): Promise<Payout> {
    const payout = await this.payouts.findById(id)
    if (!payout) throw new AppError('Payout not found', 404)
    if (payout.provider !== 'paystack' || payout.isBatched || !payout.providerRef)
      throw new AppError('Use the reconciliation queue for this payout.', 409)
    const result = await this.gateway.verifyTransfer(payout.providerRef)
    if (
      result.reference !== payout.providerRef ||
      Number(result.raw?.amount) !== Math.round(payout.netAmount * 100) ||
      result.raw?.currency !== payout.currency
    )
      throw new AppError('Provider transfer details do not match this payout.', 409)
    await this.payouts.setProviderStatus?.(id, result.status)
    if (result.status === 'success') await this.settle.handleSuccess(payout.providerRef)
    else if (['failed', 'abandoned', 'blocked', 'rejected'].includes(result.status))
      await this.settle.handleFailed(payout.providerRef)
    else if (result.status === 'reversed') await this.settle.handleReversed(payout.providerRef)
    if (
      ['success', 'failed', 'abandoned', 'blocked', 'rejected', 'reversed'].includes(result.status)
    )
      await this.settle.repairSettlement(id)
    if (action !== 'refresh') {
      if (payout.status !== 'PROCESSING' || result.status !== 'otp' || !result.transferCode)
        throw new AppError('Transfer is no longer awaiting OTP. Refresh its status.', 409)
      if (action === 'authorize') {
        if (!otp || !/^\d{6}$/.test(otp))
          throw new AppError('Enter the six-digit Paystack OTP.', 422)
        if (!this.gateway.finalizeTransfer)
          throw new AppError('Transfer authorization is unavailable.', 503)
        await this.gateway.finalizeTransfer(result.transferCode, otp)
      } else {
        if (!this.gateway.resendTransferOtp) throw new AppError('OTP resend is unavailable.', 503)
        await this.gateway.resendTransferOtp(result.transferCode)
      }
      // Provider verification, not the authorization response, drives ledger settlement.
      return this.execute(id, 'refresh')
    }
    return toPayoutDto((await this.payouts.findById(id))!)
  }
}
