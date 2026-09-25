import { MongoReportRepository } from './MongoReportRepository.js';
import type {
  AdminReportRepositoryPort,
  ReportListParams,
  ReportReviewInput,
} from '../../../../domain/ports/outbound/AdminReportRepositoryPort.js';
import type { ReportRecord } from '../../../../domain/ports/outbound/ReportRepositoryPort.js';
import {
  ReportModel,
  type ReportDocument,
} from '../../../database/models/ReportModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';

function toDomain(doc: ReportDocument): ReportRecord {
  return {
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    reporterId: doc.reporterId,
    reason: doc.reason,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt,
    reviewNotes: doc.reviewNotes,
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
  /** Includes the staff review metadata the donor-facing mapping omits. */
  override async findById(id: string): Promise<ReportRecord | null> {
    const doc = await ReportModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

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

  async review(
    id: string,
    input: ReportReviewInput
  ): Promise<ReportRecord | null> {
    return new MongoUnitOfWork().run(async () => {
      // Conditional on 'pending': a concurrent or repeated decision matches
      // nothing, so the first reviewer's notes and audit row stand.
      const doc = await ReportModel.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: input.status,
            reviewedBy: input.reviewerId,
            reviewedAt: new Date(),
            reviewNotes: input.notes,
          },
        },
        { new: true }
      );
      if (!doc) return null;
      await AuditLogModel.create({
        actorId: input.reviewerId,
        actorRole: 'admin',
        action: `campaign_report.${input.status}`,
        resource: `campaign-report:${id}`,
        details: `Campaign ${doc.campaignId} report (${doc.reason}) marked ${input.status}`,
        reason: input.notes,
        severity: 'info',
        method: 'PUT',
        path: '/reports/:id/review',
        statusCode: 200,
      });
      return toDomain(doc);
    });
  }
}
