import { MongoReportRepository } from './MongoReportRepository.js';
import type {
  AdminReportRepositoryPort,
  ReportListParams,
} from '../../../../domain/ports/outbound/AdminReportRepositoryPort.js';
import type {
  ReportRecord,
  ReportStatus,
} from '../../../../domain/ports/outbound/ReportRepositoryPort.js';
import {
  ReportModel,
  type ReportDocument,
} from '../../../database/models/ReportModel.js';

function toDomain(doc: ReportDocument): ReportRecord {
  return {
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    reporterId: doc.reporterId,
    reason: doc.reason,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

/**
 * Extends the existing MongoReportRepository (rather than editing it) so the
 * donor-facing report-a-campaign flow keeps its original repository, while
 * the moderation console gets the additional listing/review operations it
 * needs against the same underlying `Report` collection.
 */
export class MongoAdminReportRepository
  extends MongoReportRepository
  implements AdminReportRepositoryPort
{
  async findAll(
    params: ReportListParams
  ): Promise<{ items: ReportRecord[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const filter = params.status ? { status: params.status } : {};

    const [docs, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      ReportModel.countDocuments(filter),
    ]);

    return { items: docs.map(toDomain), total };
  }

  async updateStatus(
    id: string,
    status: ReportStatus
  ): Promise<ReportRecord | null> {
    const doc = await ReportModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
