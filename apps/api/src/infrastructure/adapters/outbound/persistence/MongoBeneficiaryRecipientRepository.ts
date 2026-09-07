import type { BeneficiaryRecipient } from '@ubuntu-fund/types';
import type { BeneficiaryRecipientRepositoryPort } from '../../../../domain/ports/outbound/BeneficiaryRecipientRepositoryPort.js';
import {
  BeneficiaryRecipientModel,
  type BeneficiaryRecipientDocument,
} from '../../../database/models/BeneficiaryRecipientModel.js';

function toDomain(doc: BeneficiaryRecipientDocument): BeneficiaryRecipient {
  return {
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    beneficiaryId: doc.beneficiaryId,
    type: doc.type,
    accountNumber: doc.accountNumber,
    bankCode: doc.bankCode,
    accountName: doc.accountName,
    recipientCode: doc.recipientCode,
    currency: doc.currency,
    kycVerified: doc.kycVerified,
    kycVerifiedBy: doc.kycVerifiedBy,
    kycVerifiedAt: doc.kycVerifiedAt,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

export class MongoBeneficiaryRecipientRepository
  implements BeneficiaryRecipientRepositoryPort
{
  async upsert(recipient: BeneficiaryRecipient): Promise<BeneficiaryRecipient> {
    // Replacing the destination resets KYC — a new account must be re-verified.
    const doc = await BeneficiaryRecipientModel.findOneAndUpdate(
      { campaignId: recipient.campaignId, beneficiaryId: recipient.beneficiaryId },
      {
        $set: {
          type: recipient.type,
          accountNumber: recipient.accountNumber,
          bankCode: recipient.bankCode,
          accountName: recipient.accountName,
          recipientCode: recipient.recipientCode,
          currency: recipient.currency,
          kycVerified: false,
          kycVerifiedBy: undefined,
          kycVerifiedAt: undefined,
          createdBy: recipient.createdBy,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return toDomain(doc!);
  }

  async findByCampaignAndBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<BeneficiaryRecipient | null> {
    const doc = await BeneficiaryRecipientModel.findOne({ campaignId, beneficiaryId });
    return doc ? toDomain(doc) : null;
  }

  async findById(id: string): Promise<BeneficiaryRecipient | null> {
    const doc = await BeneficiaryRecipientModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async setKycVerified(
    campaignId: string,
    beneficiaryId: string,
    verifiedBy: string
  ): Promise<BeneficiaryRecipient | null> {
    const doc = await BeneficiaryRecipientModel.findOneAndUpdate(
      { campaignId, beneficiaryId },
      { $set: { kycVerified: true, kycVerifiedBy: verifiedBy, kycVerifiedAt: new Date() } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
