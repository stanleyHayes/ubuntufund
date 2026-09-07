import { CampaignSplitVersionEntity } from '../../../../domain/entities/CampaignSplitVersion.js';
import type { CampaignSplitRepositoryPort } from '../../../../domain/ports/outbound/CampaignSplitRepositoryPort.js';
import type { BeneficiaryConsentStatus } from '@ubuntu-fund/types';
import {
  CampaignSplitVersionModel,
  type CampaignSplitVersionDocument,
} from '../../../database/models/CampaignSplitVersionModel.js';

function toDomain(
  doc: CampaignSplitVersionDocument
): CampaignSplitVersionEntity {
  return new CampaignSplitVersionEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    version: doc.version,
    status: doc.status,
    allocations: doc.allocations.map((a) => ({
      beneficiaryId: a.beneficiaryId,
      name: a.name,
      email: a.email,
      shareBps: a.shareBps,
      consent: a.consent,
      consentAt: a.consentAt,
    })),
    locked: doc.locked ?? false,
    lockedAt: doc.lockedAt,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoCampaignSplitRepository
  implements CampaignSplitRepositoryPort
{
  async create(
    split: CampaignSplitVersionEntity
  ): Promise<CampaignSplitVersionEntity> {
    const p = split.toPlain();
    const doc = await CampaignSplitVersionModel.create({
      campaignId: p.campaignId,
      version: p.version,
      status: p.status,
      allocations: p.allocations,
      locked: p.locked,
      lockedAt: p.lockedAt,
      createdBy: p.createdBy,
    });
    return toDomain(doc);
  }

  async findActive(
    campaignId: string
  ): Promise<CampaignSplitVersionEntity | null> {
    const doc = await CampaignSplitVersionModel.findOne({
      campaignId,
      status: 'active',
    });
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignAndVersion(
    campaignId: string,
    version: number
  ): Promise<CampaignSplitVersionEntity | null> {
    const doc = await CampaignSplitVersionModel.findOne({ campaignId, version });
    return doc ? toDomain(doc) : null;
  }

  async findAllByCampaign(
    campaignId: string
  ): Promise<CampaignSplitVersionEntity[]> {
    const docs = await CampaignSplitVersionModel.find({ campaignId }).sort({
      version: -1,
    });
    return docs.map(toDomain);
  }

  async nextVersion(campaignId: string): Promise<number> {
    const latest = await CampaignSplitVersionModel.findOne({ campaignId }).sort({
      version: -1,
    });
    return (latest?.version ?? 0) + 1;
  }

  async setConsent(
    campaignId: string,
    version: number,
    beneficiaryId: string,
    status: BeneficiaryConsentStatus
  ): Promise<CampaignSplitVersionEntity | null> {
    const doc = await CampaignSplitVersionModel.findOneAndUpdate(
      {
        campaignId,
        version,
        locked: false,
        'allocations.beneficiaryId': beneficiaryId,
      },
      {
        $set: {
          'allocations.$[b].consent': status,
          'allocations.$[b].consentAt': new Date(),
        },
      },
      { new: true, arrayFilters: [{ 'b.beneficiaryId': beneficiaryId }] }
    );
    return doc ? toDomain(doc) : null;
  }

  async activate(
    campaignId: string,
    version: number
  ): Promise<CampaignSplitVersionEntity | null> {
    // Supersede any OTHER currently-active version, then promote the target.
    await CampaignSplitVersionModel.updateMany(
      { campaignId, status: 'active', version: { $ne: version } },
      { $set: { status: 'superseded' } }
    );
    const doc = await CampaignSplitVersionModel.findOneAndUpdate(
      { campaignId, version, status: { $in: ['draft', 'active'] } },
      { $set: { status: 'active' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async lockActive(
    campaignId: string
  ): Promise<CampaignSplitVersionEntity | null> {
    const doc = await CampaignSplitVersionModel.findOneAndUpdate(
      { campaignId, status: 'active', locked: false },
      { $set: { locked: true, lockedAt: new Date() } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
