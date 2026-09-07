import type { CampaignBeneficiaryAccrual } from '@ubuntu-fund/types';
import type { CampaignBeneficiaryAccrualRepositoryPort } from '../../../../domain/ports/outbound/CampaignBeneficiaryAccrualRepositoryPort.js';
import {
  CampaignBeneficiaryAccrualModel,
  type CampaignBeneficiaryAccrualDocument,
} from '../../../database/models/CampaignBeneficiaryAccrualModel.js';

function toDomain(
  doc: CampaignBeneficiaryAccrualDocument
): CampaignBeneficiaryAccrual {
  return {
    campaignId: doc.campaignId,
    donationIntentId: doc.donationIntentId,
    splitVersion: doc.splitVersion,
    currency: doc.currency,
    entries: doc.entries.map((e) => ({
      beneficiaryId: e.beneficiaryId,
      amount: e.amount,
    })),
    reversed: doc.reversed,
    createdAt: doc.createdAt,
  };
}

/** Mongo duplicate-key error code (a unique-index violation). */
const DUPLICATE_KEY = 11000;

export class MongoCampaignBeneficiaryAccrualRepository
  implements CampaignBeneficiaryAccrualRepositoryPort
{
  async record(accrual: CampaignBeneficiaryAccrual): Promise<boolean> {
    try {
      await CampaignBeneficiaryAccrualModel.create({
        campaignId: accrual.campaignId,
        donationIntentId: accrual.donationIntentId,
        splitVersion: accrual.splitVersion,
        currency: accrual.currency,
        entries: accrual.entries,
        reversed: accrual.reversed,
      });
      return true;
    } catch (error) {
      // A concurrent/retried settlement already recorded this donation's split;
      // treat as idempotent (the first writer's credits stand).
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === DUPLICATE_KEY
      ) {
        return false;
      }
      throw error;
    }
  }

  async findByDonationIntent(
    donationIntentId: string
  ): Promise<CampaignBeneficiaryAccrual | null> {
    const doc = await CampaignBeneficiaryAccrualModel.findOne({ donationIntentId });
    return doc ? toDomain(doc) : null;
  }

  async markReversed(donationIntentId: string): Promise<boolean> {
    const doc = await CampaignBeneficiaryAccrualModel.findOneAndUpdate(
      { donationIntentId, reversed: false },
      { $set: { reversed: true } },
      { new: true }
    );
    return doc !== null;
  }

  async listByBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<CampaignBeneficiaryAccrual[]> {
    const docs = await CampaignBeneficiaryAccrualModel.find({
      campaignId,
      'entries.beneficiaryId': beneficiaryId,
    }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }
}
