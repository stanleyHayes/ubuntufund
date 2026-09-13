import type { RefundFundsPort } from '../../../../domain/ports/outbound/RefundFundsPort.js';
import type { RefundOperation } from '../../../../domain/ports/outbound/RefundOperationRepositoryPort.js';
import { toMinorUnits, fromMinorUnits } from '../../../../domain/value-objects/Money.js';
import { distributeByShares } from '../../../../application/services/splitDistribution.js';
import { CampaignBalanceModel } from '../../../database/models/CampaignBalanceModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../../database/models/CampaignBeneficiaryBalanceModel.js';
import { CampaignBeneficiaryAccrualModel } from '../../../database/models/CampaignBeneficiaryAccrualModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/** Moves refundable net out of payout-eligible buckets, without changing raised
 * totals or posting a refund before provider processing is verified. */
export class MongoRefundFunds implements RefundFundsPort {
  async reserve(operation: RefundOperation) {
    const { campaignId, currency, beneficiaryNet, id: operationId } = operation;
    if (!Number.isFinite(beneficiaryNet) || beneficiaryNet < 0) throw new AppError('Invalid refund accounting; reconciliation required', 409);
    const accrual = await CampaignBeneficiaryAccrualModel.findOne({ donationIntentId: operation.intentId }).lean();
    let beneficiaryHolds: { beneficiaryId: string; amount: number }[] = [];
    if (accrual) {
      // The existing split accrual/reversal rail is GHS-only. Do not silently
      // reinterpret historical foreign-currency split rounding here.
      const netMinor = toMinorUnits(beneficiaryNet, currency);
      const weights = accrual.entries.map(entry => toMinorUnits(entry.amount, currency));
      const total = weights.reduce((sum, value) => sum + value, 0);
      if (currency !== 'GHS' || accrual.currency !== currency || accrual.campaignId !== campaignId || accrual.reversed || netMinor > total - accrual.reversedMinor) {
        throw new AppError('Split refund requires balance reconciliation', 409);
      }
      if (netMinor > 0) {
        const parts = distributeByShares(netMinor, weights);
        beneficiaryHolds = accrual.entries.map((entry, index) => ({ beneficiaryId: entry.beneficiaryId, amount: fromMinorUnits(parts[index]!, currency) })).filter(entry => entry.amount > 0);
      }
    }
    const held = await CampaignBalanceModel.updateOne({ campaignId, currency, pendingBalance: { $gte: beneficiaryNet }, 'refundHolds.operationId': { $ne: operationId } }, {
      $inc: { pendingBalance: -beneficiaryNet }, $push: { refundHolds: { operationId, amount: beneficiaryNet } }, $set: { updatedAt: new Date() },
    });
    if (held.matchedCount !== 1) throw new AppError('Campaign funds are no longer available for this refund', 409);
    for (const entry of beneficiaryHolds) {
      const heldBeneficiary = await CampaignBeneficiaryBalanceModel.updateOne({ campaignId, beneficiaryId: entry.beneficiaryId, currency, pendingBalance: { $gte: entry.amount }, 'refundHolds.operationId': { $ne: operationId } }, {
        $inc: { pendingBalance: -entry.amount }, $push: { refundHolds: { operationId, amount: entry.amount } }, $set: { updatedAt: new Date() },
      });
      if (heldBeneficiary.matchedCount !== 1) throw new AppError('Beneficiary funds are no longer available for this refund', 409);
    }
    return beneficiaryHolds;
  }

  async restoreForReversal(operation: RefundOperation) {
    // Legacy operations lack proven holds. Never manufacture or release funds
    // for them: their existing guarded reversal must reconcile available data.
    if (operation.fundsHoldVersion !== 1) return;
    const { campaignId, currency, beneficiaryNet, id: operationId } = operation;
    const restored = await CampaignBalanceModel.updateOne({ campaignId, currency, refundHolds: { $elemMatch: { operationId, amount: beneficiaryNet } } }, {
      $inc: { pendingBalance: beneficiaryNet }, $pull: { refundHolds: { operationId } }, $set: { updatedAt: new Date() },
    });
    if (restored.matchedCount !== 1) throw new AppError('Refund funds hold requires reconciliation', 409);
    for (const entry of operation.beneficiaryHolds ?? []) {
      const restoredBeneficiary = await CampaignBeneficiaryBalanceModel.updateOne({ campaignId, beneficiaryId: entry.beneficiaryId, currency, refundHolds: { $elemMatch: { operationId, amount: entry.amount } } }, {
        $inc: { pendingBalance: entry.amount }, $pull: { refundHolds: { operationId } }, $set: { updatedAt: new Date() },
      });
      if (restoredBeneficiary.matchedCount !== 1) throw new AppError('Beneficiary refund hold requires reconciliation', 409);
    }
  }
}
