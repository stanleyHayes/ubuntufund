import mongoose from 'mongoose';
import { UserRole } from '@ubuntu-fund/types';
import type { OrganizationRecord } from '../../../../domain/entities/Organization.js';
import { deriveOrganizationSlug } from '../../../../domain/entities/Organization.js';
import type { OrganizationRepositoryPort } from '../../../../domain/ports/outbound/OrganizationRepositoryPort.js';
import {
  OrganizationUserModel,
  type OrganizationUserDocument,
} from '../../../database/models/OrganizationModel.js';

/** Users are only organizations once they've registered with a name. */
const ORGANIZATION_QUERY = {
  role: UserRole.ORGANIZATION,
  organizationName: { $exists: true, $ne: null },
  deletedAt: { $exists: false },
};

function toDomain(doc: OrganizationUserDocument): OrganizationRecord {
  return {
    id: doc._id!.toString(),
    name: doc.organizationName ?? doc.name,
    email: doc.email,
    avatarUrl: doc.avatarUrl,
    coverUrl: doc.coverUrl,
    country: doc.country,
    role: doc.role,
    verificationLevel: doc.verificationLevel,
    organizationType: doc.organizationType,
    registrationNumber: doc.registrationNumber,
    website: doc.website,
    emailVerified: doc.emailVerified,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoOrganizationRepository implements OrganizationRepositoryPort {
  async findAll(): Promise<OrganizationRecord[]> {
    const docs = await OrganizationUserModel.find(ORGANIZATION_QUERY).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await OrganizationUserModel.findOne({
      _id: id,
      ...ORGANIZATION_QUERY,
    });
    return doc ? toDomain(doc) : null;
  }

  async findBySlugOrId(slugOrId: string): Promise<OrganizationRecord | null> {
    const byId = await this.findById(slugOrId);
    if (byId) {
      return byId;
    }

    // Slugs derive from names, so two organizations can share one. Resolve
    // to the oldest deterministically: a newer namesake must never take over
    // an established organization's URL.
    const all = await this.findAll();
    return all
      .filter((org) => deriveOrganizationSlug(org.name) === slugOrId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0] ?? null;
  }
}
