import { TransferRecipientEntity } from '../../../../domain/entities/TransferRecipient.js';
import type { TransferRecipientRepositoryPort } from '../../../../domain/ports/outbound/TransferRecipientRepositoryPort.js';
import {
  TransferRecipientModel,
  type TransferRecipientDocument,
} from '../../../database/models/TransferRecipientModel.js';

function toDomain(doc: TransferRecipientDocument): TransferRecipientEntity {
  return new TransferRecipientEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    createdBy: doc.createdBy,
    type: doc.type,
    accountNumber: doc.accountNumber,
    bankCode: doc.bankCode,
    accountName: doc.accountName,
    recipientCode: doc.recipientCode,
    currency: doc.currency,
    createdAt: doc.createdAt,
  });
}

export class MongoTransferRecipientRepository
  implements TransferRecipientRepositoryPort
{
  async create(
    recipient: TransferRecipientEntity
  ): Promise<TransferRecipientEntity> {
    const p = recipient.toPlain();
    const doc = await TransferRecipientModel.create({
      campaignId: p.campaignId,
      createdBy: p.createdBy,
      type: p.type,
      accountNumber: p.accountNumber,
      bankCode: p.bankCode,
      accountName: p.accountName,
      recipientCode: p.recipientCode,
      currency: p.currency,
      createdAt: p.createdAt,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<TransferRecipientEntity | null> {
    const doc = await TransferRecipientModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(
    campaignId: string
  ): Promise<TransferRecipientEntity[]> {
    const docs = await TransferRecipientModel.find({ campaignId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findLatestByCampaignId(
    campaignId: string
  ): Promise<TransferRecipientEntity | null> {
    const doc = await TransferRecipientModel.findOne({ campaignId }).sort({
      createdAt: -1,
    });
    return doc ? toDomain(doc) : null;
  }
}
