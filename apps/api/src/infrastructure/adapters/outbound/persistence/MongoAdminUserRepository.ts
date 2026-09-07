import type {
  AdminUserRepositoryPort,
  AdminUserListParams,
  AdminUserRecord,
} from '../../../../domain/ports/outbound/AdminUserRepositoryPort.js';
import {
  UserModel,
  type UserDocument,
} from '../../../database/models/UserModel.js';

function toRecord(doc: UserDocument): AdminUserRecord {
  return {
    id: doc._id!.toString(),
    email: doc.email,
    name: doc.name,
    avatarUrl: doc.avatarUrl,
    role: doc.role,
    verificationLevel: doc.verificationLevel,
    trustScore: doc.trustScore,
    country: doc.country,
    emailVerified: doc.emailVerified,
    complianceApprovedCampaignLimit: doc.complianceApprovedCampaignLimit,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoAdminUserRepository implements AdminUserRepositoryPort {
  async findUserById(id: string): Promise<AdminUserRecord | null> {
    const doc = await UserModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    return doc ? toRecord(doc) : null;
  }

  async listUsers(
    params: AdminUserListParams
  ): Promise<{ items: AdminUserRecord[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const sortField = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const [docs, total] = await Promise.all([
      UserModel.find({ deletedAt: { $exists: false } })
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(pageSize),
      UserModel.countDocuments({ deletedAt: { $exists: false } }),
    ]);

    return {
      items: docs.map(toRecord),
      total,
    };
  }
}
