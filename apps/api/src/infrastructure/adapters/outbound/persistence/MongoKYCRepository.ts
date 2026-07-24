import type { VerificationType } from '@ubuntu-fund/types';
import type {
  KYCRepositoryPort,
  KYCVerificationRecord,
} from '../../../../domain/ports/outbound/KYCRepositoryPort.js';
import {
  KYCVerificationModel,
  type KYCVerificationDocument,
} from '../../../database/models/KYCVerificationModel.js';

function toDomain(doc: KYCVerificationDocument): KYCVerificationRecord {
  return {
    id: doc._id!.toString(),
    userId: doc.userId,
    verificationType: doc.verificationType,
    status: doc.status,
    documents: doc.documents,
    personalInfo: doc.personalInfo,
    businessInfo: doc.businessInfo,
    riskLevel: doc.riskLevel,
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt,
    reviewNotes: doc.reviewNotes,
    expiryDate: doc.expiryDate,
    rejectionReason: doc.rejectionReason,
    retryCount: doc.retryCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoKYCRepository implements KYCRepositoryPort {
  async save(record: KYCVerificationRecord): Promise<KYCVerificationRecord> {
    const doc = await KYCVerificationModel.create({
      userId: record.userId,
      verificationType: record.verificationType,
      status: record.status,
      documents: record.documents,
      personalInfo: record.personalInfo,
      businessInfo: record.businessInfo,
      riskLevel: record.riskLevel,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt,
      reviewNotes: record.reviewNotes,
      expiryDate: record.expiryDate,
      rejectionReason: record.rejectionReason,
      retryCount: record.retryCount,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<KYCVerificationRecord | null> {
    const doc = await KYCVerificationModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByUserId(userId: string): Promise<KYCVerificationRecord[]> {
    const docs = await KYCVerificationModel.find({ userId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findActiveByUserIdAndType(
    userId: string,
    verificationType: VerificationType
  ): Promise<KYCVerificationRecord | null> {
    const doc = await KYCVerificationModel.findOne({
      userId,
      verificationType,
      status: { $in: ['pending', 'in_review'] },
    });
    return doc ? toDomain(doc) : null;
  }

  async findPending(): Promise<KYCVerificationRecord[]> {
    const docs = await KYCVerificationModel.find({ status: 'pending' }).sort({
      createdAt: 1,
    });
    return docs.map(toDomain);
  }

  async update(record: KYCVerificationRecord): Promise<KYCVerificationRecord> {
    const doc = await KYCVerificationModel.findByIdAndUpdate(
      record.id,
      {
        status: record.status,
        riskLevel: record.riskLevel,
        reviewedBy: record.reviewedBy,
        reviewedAt: record.reviewedAt,
        reviewNotes: record.reviewNotes,
        expiryDate: record.expiryDate,
        rejectionReason: record.rejectionReason,
        retryCount: record.retryCount,
      },
      { new: true }
    );
    if (!doc) {
      throw new Error('KYC verification record not found');
    }
    return toDomain(doc);
  }
}
